import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import protect from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import Resume from '../Model/Resume.js';
import ResumeGeneration from '../Model/ResumeGeneration.js';
import User from '../Model/User.js';
import razorpay from '../Services/razorpay.js';
import { sendOtp, verifyOtp, OtpError } from '../Services/otpService.js';
import { refreshSubscription } from '../Services/subscriptionService.js';
import { generateResumePdf } from '../Services/resumePdf.jsx';
import { sendMail } from '../Services/mailer.js'; 

const router = Router();
const RESUME_PRICE = 50;
const OTP_VALID_FOR_ORDER_MS = 10 * 60 * 1000; // must order within 10 min of OTP verify
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'resumes');

const payLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

function validSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function invoiceNumber(gen) {
  const d = new Date();
  const ym = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `RES-${ym}-${gen._id.toString().slice(-6).toUpperCase()}`;
}

// Every resume route requires Premium — gate it once, here.
router.use(protect, async (req, res, next) => {
  await refreshSubscription(req.user);
  if (!req.user.isPremium) {
    return res.status(403).json({ error: 'Resume Builder is a Premium feature', code: 'PREMIUM_REQUIRED' });
  }
  next();
});

// ---- CRUD on draft resumes (free to edit; payment only gates generation) ----

router.post('/', async (req, res) => {
  const resume = await Resume.create({ userId: req.user._id, ...req.body });
  res.status(201).json({ resume });
});

router.get('/', async (req, res) => {
  const resumes = await Resume.find({ userId: req.user._id }).sort({ updatedAt: -1 });
  res.json({ resumes });
});

router.get('/:id', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  res.json({ resume });
});

router.patch('/:id', async (req, res) => {
  const resume = await Resume.findOneAndUpdate(
    { _id: req.params.id, userId: req.user._id },
    { $set: req.body },
    { new: true, runValidators: true }
  );
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  // Editing after a paid generation invalidates the PDF on file — it no
  // longer matches what was paid for, so don't let a stale link stand in
  // for the new content.
  if (resume.status === 'generated') {
    resume.status = 'draft';
    resume.pdfUrl = null;
    await resume.save();
  }
  res.json({ resume });
});

router.post('/:id/set-default', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume) return res.status(404).json({ error: 'Resume not found' });
  if (resume.status !== 'generated') {
    return res.status(400).json({ error: 'Only a generated resume can be set as default' });
  }
  req.user.defaultResumeId = resume._id;
  await req.user.save();
  res.json({ success: true });
});

// ---- Generation: OTP → order → verify → PDF ----

router.post('/:id/generate/otp', async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) return res.status(404).json({ error: 'Resume not found' });
    if (!resume.personal?.fullName || !resume.personal?.email) {
      return res.status(400).json({ error: 'Add at least your name and email before generating' });
    }

    const { expiresAt, cooldownSeconds } = await sendOtp({
      userId: req.user._id, purpose: 'RESUME_PAYMENT', sentTo: req.user.email,
    });

    const gen = await ResumeGeneration.create({
      resumeId: resume._id, userId: req.user._id, amount: RESUME_PRICE,
    });

    res.json({ generationId: gen._id, expiresAt, cooldownSeconds });
  } catch (err) {
    if (err instanceof OtpError) return res.status(429).json({ error: err.message, code: err.code });
    console.error('resume otp request failed:', err);
    res.status(500).json({ error: 'Could not send verification code' });
  }
});

router.post('/:id/generate/verify-otp', async (req, res) => {
  try {
    const { generationId, code } = req.body;
    const gen = await ResumeGeneration.findOne({
      _id: generationId, resumeId: req.params.id, userId: req.user._id, status: 'OTP_PENDING',
    });
    if (!gen) return res.status(404).json({ error: 'No pending verification for this resume' });

    await verifyOtp({ userId: req.user._id, purpose: 'RESUME_PAYMENT', code });

    gen.status = 'OTP_VERIFIED';
    gen.otpVerifiedAt = new Date();
    await gen.save();

    res.json({ success: true, generationId: gen._id });
  } catch (err) {
    if (err instanceof OtpError) return res.status(400).json({ error: err.message, code: err.code });
    console.error('resume otp verify failed:', err);
    res.status(500).json({ error: 'Could not verify code' });
  }
});

router.post('/:id/generate/order', payLimiter, async (req, res) => {
  try {
    const { generationId } = req.body;
    const gen = await ResumeGeneration.findOne({
      _id: generationId, resumeId: req.params.id, userId: req.user._id,
      status: { $in: ['OTP_VERIFIED', 'ORDER_CREATED'] },
    });
    if (!gen) return res.status(400).json({ error: 'Verify your email first' });

    // Payment gateway only opens once OTP is confirmed, and only within
    // a short window after — stops a verified-but-stale attempt from
    // being used to pay much later without re-confirming identity.
    if (Date.now() - gen.otpVerifiedAt.getTime() > OTP_VALID_FOR_ORDER_MS) {
      return res.status(400).json({ error: 'Verification expired, please verify again', code: 'OTP_STALE' });
    }

    if (gen.razorpayOrderId) {
      return res.json({ orderId: gen.razorpayOrderId, amount: gen.amount * 100, currency: 'INR', keyId: process.env.RAZORPAY_KEY_ID });
    }

    const order = await razorpay.orders.create({
      amount: RESUME_PRICE * 100,
      currency: 'INR',
      receipt: `res_${gen._id.toString().slice(-10)}`,
      notes: { userId: req.user._id.toString(), resumeId: req.params.id },
    });

    gen.razorpayOrderId = order.id;
    gen.status = 'ORDER_CREATED';
    await gen.save();

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('resume order failed:', err);
    res.status(500).json({ error: 'Could not start payment' });
  }
});

router.post('/:id/generate/verify-payment', payLimiter, async (req, res) => {
  try {
    const { generationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const gen = await ResumeGeneration.findOne({ _id: generationId, resumeId: req.params.id, userId: req.user._id });
    if (!gen || gen.razorpayOrderId !== razorpay_order_id) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!validSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      console.warn('resume payment signature mismatch', razorpay_order_id);
      return res.status(400).json({ error: 'Payment verification failed', code: 'BAD_SIGNATURE' });
    }

    const claimed = await ResumeGeneration.findOneAndUpdate(
      { _id: gen._id, status: { $ne: 'PAID' } },
      { $set: { status: 'PAID', razorpayPaymentId: razorpay_payment_id, razorpaySignature: razorpay_signature, paidAt: new Date(), invoiceNumber: invoiceNumber(gen) } },
      { new: true }
    );
    const current = claimed || await ResumeGeneration.findById(gen._id);
    if (!claimed && current.activated) {
      return res.json({ success: true, alreadyProcessed: true, pdfUrl: (await Resume.findById(req.params.id)).pdfUrl });
    }

    // Generate + persist the PDF only now, after payment is confirmed.
    const resume = await Resume.findById(req.params.id);
    const buffer = await generateResumePdf(resume);

    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const filename = `${resume._id}-${Date.now()}.pdf`;
    await fs.writeFile(path.join(STORAGE_DIR, filename), buffer);
    const pdfUrl = `/api/resume/${resume._id}/download`; // served through the authed route below, not a static path

    resume.status = 'generated';
    resume.pdfUrl = filename; // store the filename; the download route resolves the real path
    resume.pdfGeneratedAt = new Date();
    resume.paid = true;
    await resume.save();

    await ResumeGeneration.findByIdAndUpdate(current._id, { $set: { activated: true } });

    if (claimed) {
      sendMail({
        to: req.user.email,
        subject: `Resume generated – ${current.invoiceNumber}`,
        text: `Your resume PDF has been generated.\n\nInvoice: ${current.invoiceNumber}\nTransaction ID: ${razorpay_payment_id}\nAmount: ₹${RESUME_PRICE}\n\nDownload it anytime from your profile.`,
        html: `<p>Your resume PDF has been generated.</p><p>Invoice: <b>${current.invoiceNumber}</b><br/>Transaction ID: ${razorpay_payment_id}<br/>Amount: ₹${RESUME_PRICE}</p>`,
      }).catch((e) => console.error('resume invoice email failed:', e));
    }

    res.json({ success: true, pdfUrl, invoiceNumber: current.invoiceNumber });
  } catch (err) {
    console.error('resume payment verify failed:', err);
    res.status(500).json({ error: 'Could not verify payment' });
  }
});

router.post('/:id/generate/failed', async (req, res) => {
  const { generationId, reason, cancelled } = req.body;
  await ResumeGeneration.updateOne(
    { _id: generationId, userId: req.user._id, status: { $ne: 'PAID' } },
    { $set: { status: cancelled ? 'CANCELLED' : 'FAILED', failureReason: String(reason || '').slice(0, 200) } }
  );
  res.json({ success: true });
});

// ---- Download: only ever serves a file the user already paid for ----

router.get('/:id/download', async (req, res) => {
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
  if (!resume || resume.status !== 'generated' || !resume.pdfUrl) {
    return res.status(404).json({ error: 'No generated PDF for this resume' });
  }
  const filePath = path.join(STORAGE_DIR, resume.pdfUrl);
  res.download(filePath, `${resume.personal?.fullName || 'resume'}.pdf`);
});

export default router;