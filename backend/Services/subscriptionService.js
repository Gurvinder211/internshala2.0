import User from '../Model/User.js';
import { PLANS, CYCLE_DAYS, UNLIMITED } from './plans.js';

const CYCLE_MS = CYCLE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Lazily brings a user's subscription in line with the clock:
 *  1. a paid plan past validTill drops to FREE
 *  2. quota resets at each 30-day cycle boundary (works for FREE and paid)
 * Call before any read/decision that depends on plan or quota.
 */
export async function refreshSubscription(user, now = new Date()) {
  const sub = user.subscription;
  let changed = false;

  if (sub.plan !== 'FREE' && sub.validTill && sub.validTill <= now) {
    sub.plan = 'FREE';
    sub.quotaLimit = PLANS.FREE.quota;
    sub.quotaUsed = 0;
    sub.cycleStartDate = now;
    sub.validTill = null;
    user.isPremium = false;
    changed = true;
  }

  const elapsed = now.getTime() - new Date(sub.cycleStartDate).getTime();
  if (elapsed >= CYCLE_MS) {
    const cycles = Math.floor(elapsed / CYCLE_MS);
    sub.cycleStartDate = new Date(new Date(sub.cycleStartDate).getTime() + cycles * CYCLE_MS);
    sub.quotaUsed = 0;
    changed = true;
  }

  if (changed) {
    user.markModified('subscription');
    await user.save();
  }
  return user;
}

export function isActivePaid(sub, now = new Date()) {
  return sub.plan !== 'FREE' && sub.validTill && sub.validTill > now;
}

/** Server decides what a payment means; the client only names the target plan. */
export function resolveAction(sub, targetPlan, now = new Date()) {
  if (!isActivePaid(sub, now)) return 'PURCHASE';
  const cur = PLANS[sub.plan].rank;
  const tgt = PLANS[targetPlan].rank;
  if (tgt > cur) return 'UPGRADE';
  if (tgt === cur) return 'RENEW';
  return 'DOWNGRADE_BLOCKED'; // paying for a lower plan while on a higher one
}

/** Applies a verified payment to the user. Uses the plan stored on the transaction, never client input. */
export async function applyPaidPlan(tx, now = new Date()) {
  const user = await User.findById(tx.userId);
  await refreshSubscription(user, now);
  const sub = user.subscription;
  const plan = PLANS[tx.plan];

  let validFrom, validTill;
  if (tx.action === 'RENEW' && sub.plan === tx.plan && isActivePaid(sub, now)) {
    // Early renewal: extend the end date; quota and cycle clock keep running.
    validFrom = sub.validTill;
    validTill = new Date(sub.validTill.getTime() + CYCLE_MS);
  } else {
    // New purchase / upgrade / renewal after expiry: fresh cycle with fresh quota.
    validFrom = now;
    validTill = new Date(now.getTime() + CYCLE_MS);
    sub.plan = tx.plan;
    sub.quotaLimit = plan.quota;
    sub.quotaUsed = 0;
    sub.cycleStartDate = now;
  }
  sub.validTill = validTill;
  sub.nextPlan = null;
  user.isPremium = true;
  user.markModified('subscription');
  await user.save();
  return { user, validFrom, validTill };
}

/**
 * Atomically takes one application from the quota.
 * Single conditional update, so two simultaneous applications
 * can't both slip past the last remaining slot.
 */
export async function consumeQuota(userId) {
  const unlimited = await User.findOneAndUpdate(
    { _id: userId, 'subscription.quotaLimit': UNLIMITED },
    { $inc: { 'subscription.quotaUsed': 1 } },
    { new: true }
  );
  if (unlimited) return true;

  const limited = await User.findOneAndUpdate(
    { _id: userId, $expr: { $lt: ['$subscription.quotaUsed', '$subscription.quotaLimit'] } },
    { $inc: { 'subscription.quotaUsed': 1 } },
    { new: true }
  );
  return !!limited;
}

export async function releaseQuota(userId) {
  await User.updateOne(
    { _id: userId, 'subscription.quotaUsed': { $gt: 0 } },
    { $inc: { 'subscription.quotaUsed': -1 } }
  );
}