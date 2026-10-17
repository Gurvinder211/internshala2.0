import { Router } from 'express';
import crypto from 'crypto';
import protect from '../middleware/auth.js';
import Transaction from '../Model/Transaction.js';
import razorpay from '../Services/razorpay.js';
import { PLANS, UNLIMITED } from '../Services/plans.js';
import { isPaymentWindowOpen } from '../Services/paymentWindow.js';
import {
  refreshSubscription, isActivePaid, resolveAction, applyPaidPlan,
} from '../Services/subscriptionService.js';
import { sendMail } from '../Services/mailer.js';
import rateLimit from 'express-rate-limit';


const router = Router();
const PENDING_ORDER_REUSE_MS = 15 * 60 * 1000;
const payLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });


const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });

function validSignature(orderId, paymentId, signature) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function makeInvoiceNumber(tx) {
  const d = new Date();
  const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `INV-${ym}-${tx._id.toString().slice(-6).toUpperCase()}`;
}

function subscriptionView(user) {
  const s = user.subscription;
  const unlimited = s.quotaLimit === UNLIMITED;
  return {
    plan: s.plan,
    planName: PLANS[s.plan].name,
    isPremium: user.isPremium,
    quotaLimit: unlimited ? null : s.quotaLimit,
    unlimited,
    quotaUsed: s.quotaUsed,
    quotaRemaining: unlimited ? null : Math.max(0, s.quotaLimit - s.quotaUsed),
    validTill: s.validTill,
    renewalDate: s.validTill,
    nextPlan: s.nextPlan,
    quotaResetsAt: new Date(new Date(s.cycleStartDate).getTime() + 30 * 24 * 60 * 60 * 1000),
  };
}

async function sendInvoiceEmail(user, tx) {
  const plan = PLANS[tx.plan];
  const rows = [
    ['Invoice number', tx.invoiceNumber],
    ['Transaction ID', tx.razorpayPaymentId],
    ['Plan', `${plan.name} (${tx.action.toLowerCase()})`],
    ['Amount paid', `₹${tx.amount.toFixed(2)}`],
    ['Valid from', fmtDate(tx.validFrom)],
    ['Valid until', fmtDate(tx.validTill)],
    ['Billed to', `${tx.billing.name} (${tx.billing.email})`],
    ['Paid on', fmtDate(tx.paidAt)],
  ];
  await sendMail({
    to: user.email,
    subject: `Payment received – ${plan.name} plan (${tx.invoiceNumber})`,
    text: rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
    html: `<h2>Thanks for your payment</h2><table cellpadding="6" style="border-collapse:collapse">${
      rows.map(([k, v]) => `<tr><td><b>${k}</b></td><td>${v}</td></tr>`).join('')
    }</table>`,
  });
}

/**
 * Shared by /verify and /reconcile. Idempotent: the atomic claim means only
 * one caller can flip the transaction to PAID, so a double-submit or a
 * verify+reconcile race can never activate the plan twice.
 * FAILED/CANCELLED can still become PAID, because Razorpay's checkout lets
 * a user retry inside the same modal on the same order.
 */
async function finalizePayment(tx, paymentId, signature) {
  const claimed = await Transaction.findOneAndUpdate(
    { _id: tx._id, status: { $ne: 'PAID' } },
    {
      $set: {
        status: 'PAID',
        razorpayPaymentId: paymentId,
        razorpaySignature: signature || null,
        paidAt: new Date(),
        failureReason: null,
        invoiceNumber: makeInvoiceNumber(tx),
      },
    },
    { new: true }
  );

  const current = claimed || (await Transaction.findById(tx._id));
  if (!claimed && current.activated) return { tx: current, alreadyProcessed: true };
  // claimed now, OR paid earlier but activation never completed -> (re)apply.

  const { user, validFrom, validTill } = await applyPaidPlan(current);
  const done = await Transaction.findByIdAndUpdate(
    current._id,
    { $set: { validFrom, validTill, activated: true } },
    { new: true }
  );

  if (claimed) {
    // Email failure must never undo a successful payment.
    sendInvoiceEmail(user, done).catch((e) => console.error('invoice email failed:', e));
  }
  return { tx: done, alreadyProcessed: !claimed };
}

// GET /api/subscription/plans  (public, powers the comparison table)
router.get('/plans', (req, res) => {
  res.json({
    plans: Object.values(PLANS).map((p) => ({
      key: p.key, name: p.name, price: p.price, currency: 'INR',
      applicationsPerMonth: p.quota === UNLIMITED ? null : p.quota,
      unlimited: p.quota === UNLIMITED,
    })),
  });
});

// GET /api/subscription/me: current plan, quota, renewal date, invoices
router.get('/me', protect, async (req, res) => {
  try {
    await refreshSubscription(req.user);
    const history = await Transaction.find({ userId: req.user._id })
      .sort({ createdAt: -1 }).limit(50)
      .select('-razorpaySignature -__v');
    res.json({ subscription: subscriptionView(req.user), history });
  } catch (err) {
    console.error('subscription/me failed:', err);
    res.status(500).json({ error: 'Could not load subscription' });
  }
});

// POST /api/subscription/order   Body: { plan }
router.post('/order', payLimiter, protect, async (req, res) => {
  try {
    if (!isPaymentWindowOpen()) {
      return res.status(403).json({
        error: 'Payments are only available between 5:00 AM and 11:45 AM IST. Please try again during that time.',
        code: 'OUTSIDE_PAYMENT_WINDOW',
      });
    }

    const { plan } = req.body;
    if (!plan || !PLANS[plan] || plan === 'FREE') {
      return res.status(400).json({ error: 'Choose a valid paid plan' });
    }

    await refreshSubscription(req.user);
    const action = resolveAction(req.user.subscription, plan);
    if (action === 'DOWNGRADE_BLOCKED') {
      return res.status(400).json({
        error: 'You are on a higher plan. Use downgrade to switch when your current period ends.',
        code: 'USE_DOWNGRADE',
      });
    }

    const price = PLANS[plan].price;

    // Duplicate-attempt guard: reuse a still-open order instead of creating another.
    const open = await Transaction.findOne({
      userId: req.user._id, plan, action, status: 'CREATED',
      createdAt: { $gte: new Date(Date.now() - PENDING_ORDER_REUSE_MS) },
    });
    if (open) {
      return res.json({
        orderId: open.razorpayOrderId, amount: price * 100, currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID, plan, action, reused: true,
      });
    }

    const order = await razorpay.orders.create({
      amount: price * 100, // paise
      currency: 'INR',
      receipt: `sub_${req.user._id.toString().slice(-8)}_${Date.now()}`.slice(0, 40),
      notes: { userId: req.user._id.toString(), plan, action },
    });

    await Transaction.create({
      userId: req.user._id, plan, action, amount: price,
      razorpayOrderId: order.id,
      billing: { name: req.user.name, email: req.user.email },
    });

    res.json({
      orderId: order.id, amount: order.amount, currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, plan, action, reused: false,
    });
  } catch (err) {
    console.error('subscription/order failed:', err);
    res.status(500).json({ error: 'Could not start payment' });
  }
});

// POST /api/subscription/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
router.post('/verify', payLimiter, protect, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    // Scoped to the logged-in user, so nobody can complete someone else's order.
    const tx = await Transaction.findOne({ razorpayOrderId: razorpay_order_id, userId: req.user._id });
    if (!tx) return res.status(404).json({ error: 'Order not found' });

    if (!validSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      // Leave the order open: a genuine payment can still be settled via /reconcile.
      console.warn('signature mismatch for order', razorpay_order_id);
      return res.status(400).json({ error: 'Payment verification failed', code: 'BAD_SIGNATURE' });
    }

    const { tx: done, alreadyProcessed } = await finalizePayment(tx, razorpay_payment_id, razorpay_signature);
    await refreshSubscription(req.user);
    res.json({ success: true, alreadyProcessed, invoiceNumber: done.invoiceNumber, validTill: done.validTill });
  } catch (err) {
    console.error('subscription/verify failed:', err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

// POST /api/subscription/failed   Body: { razorpay_order_id, reason, cancelled }
// Called by the checkout's failure/dismiss handlers, for history only.
router.post('/failed', protect, async (req, res) => {
  try {
    const { razorpay_order_id, reason, cancelled } = req.body;
    await Transaction.updateOne(
      { razorpayOrderId: razorpay_order_id, userId: req.user._id, status: 'CREATED' },
      { $set: { status: cancelled ? 'CANCELLED' : 'FAILED', failureReason: String(reason || '').slice(0, 200) } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('subscription/failed failed:', err);
    res.status(500).json({ error: 'Could not record result' });
  }
});

// POST /api/subscription/reconcile   Body: { orderId }
// For "paid but the tab closed / network dropped before /verify".
// Asks Razorpay directly, so no client-supplied signature is trusted.
router.post('/reconcile', protect, async (req, res) => {
  try {
    const tx = await Transaction.findOne({ razorpayOrderId: req.body.orderId, userId: req.user._id });
    if (!tx) return res.status(404).json({ error: 'Order not found' });

    const payments = await razorpay.orders.fetchPayments(tx.razorpayOrderId);
    const captured = payments.items.find((p) => p.status === 'captured');
    if (!captured) {
      return res.status(200).json({ success: false, message: 'No completed payment found for this order yet.' });
    }

    const { tx: done } = await finalizePayment(tx, captured.id, null);
    res.json({ success: true, invoiceNumber: done.invoiceNumber, validTill: done.validTill });
  } catch (err) {
    console.error('subscription/reconcile failed:', err);
    res.status(500).json({ error: 'Could not reconcile payment' });
  }
});

// POST /api/subscription/downgrade   Body: { plan }: takes effect when the period ends
router.post('/downgrade', protect, async (req, res) => {
  try {
    await refreshSubscription(req.user);
    const sub = req.user.subscription;
    const { plan } = req.body;
    if (!isActivePaid(sub)) return res.status(400).json({ error: 'You have no active paid plan' });
    if (!PLANS[plan] || plan === 'FREE' || PLANS[plan].rank >= PLANS[sub.plan].rank) {
      return res.status(400).json({ error: 'Choose a lower paid plan' });
    }
    sub.nextPlan = plan;
    req.user.markModified('subscription');
    await req.user.save();
    res.json({ success: true, message: `You'll keep ${PLANS[sub.plan].name} until ${fmtDate(sub.validTill)}, then can continue on ${PLANS[plan].name}.` });
  } catch (err) {
    console.error('downgrade failed:', err);
    res.status(500).json({ error: 'Could not schedule downgrade' });
  }
});

// POST /api/subscription/cancel: access continues until validTill, then Free
router.post('/cancel', protect, async (req, res) => {
  try {
    await refreshSubscription(req.user);
    const sub = req.user.subscription;
    if (!isActivePaid(sub)) return res.status(400).json({ error: 'You have no active paid plan' });
    sub.nextPlan = 'FREE';
    req.user.markModified('subscription');
    await req.user.save();
    res.json({ success: true, message: `Your ${PLANS[sub.plan].name} plan stays active until ${fmtDate(sub.validTill)}, then moves to Free.` });
  } catch (err) {
    console.error('cancel failed:', err);
    res.status(500).json({ error: 'Could not cancel' });
  }
});

export default router;