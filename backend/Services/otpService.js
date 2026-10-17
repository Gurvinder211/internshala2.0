import { randomInt, createHash } from 'crypto';
import Otp from '../Model/Otp.js';
import { sendMail } from './mailer.js';

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_DAILY_REQUESTS = 5;
const MAX_VERIFY_ATTEMPTS = 5;

const PURPOSE_COPY = {
  LANGUAGE_CHANGE: {
    subject: 'Confirm your language change',
    line: 'Use this code to confirm switching your site language to French:',
  },
  RESUME_PAYMENT: {
    subject: 'Verify it\'s you before payment',
    line: 'Use this code to verify your identity before we open the payment step:',
  },
  PASSWORD_RESET: {
    subject: 'Reset your password',
    line: 'Use this code to verify your identity and reset your password:',
  },
  LOGIN_VERIFY: {
    subject: 'Verify this sign-in',
    line: 'Use this code to verify this login:',
  },
};

function generateCode() {
  // crypto.randomInt, not Math.random — this gates payments and password
  // resets, so it needs to be non-predictable.
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function hashCode(code) {
  return createHash('sha256').update(code).digest('hex');
}

class OtpError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code; // machine-readable reason, for the route to map to a status
  }
}

/**
 * Request a new OTP for a user + purpose. Enforces resend cooldown and a
 * daily cap so this can't be used to spam a mailbox or brute-force cost.
 */
async function sendOtp({ userId, purpose, sentTo, channel = 'email' }) {
  if (!PURPOSE_COPY[purpose]) {
    throw new OtpError('Unknown OTP purpose', 'INVALID_PURPOSE');
  }
  if (!sentTo) {
    throw new OtpError('No destination address on file', 'NO_DESTINATION');
  }

  const since = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000);
  const recent = await Otp.findOne({ userId, purpose, createdAt: { $gte: since } })
    .sort({ createdAt: -1 });
  if (recent) {
    const waitMs = RESEND_COOLDOWN_SECONDS * 1000 - (Date.now() - recent.createdAt.getTime());
    throw new OtpError(
      `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code`,
      'COOLDOWN'
    );
  }

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countToday = await Otp.countDocuments({ userId, purpose, createdAt: { $gte: dayAgo } });
  if (countToday >= MAX_DAILY_REQUESTS) {
    throw new OtpError('Too many code requests today. Try again tomorrow.', 'DAILY_CAP');
  }

  // Invalidate any still-live OTP for this exact purpose so only the
  // newest code can ever be verified.
  await Otp.updateMany(
    { userId, purpose, consumed: false },
    { $set: { consumed: true } }
  );

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await Otp.create({
    userId,
    purpose,
    sentTo,
    channel,
    codeHash: hashCode(code),
    expiresAt,
  });

  if (channel === 'email') {
    const copy = PURPOSE_COPY[purpose];
    await sendMail({
      to: sentTo,
      subject: copy.subject,
      text: `${copy.line}\n\n${code}\n\nThis code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.`,
      html: `<p>${copy.line}</p><h2 style="letter-spacing:4px">${code}</h2><p>This code expires in ${OTP_TTL_MINUTES} minutes. If you didn't request this, ignore this email.</p>`,
    });
  }
  // SMS channel: plug in an SMS provider here when phone-based OTP is needed
  // (Forgot Password allows phone as an option).

  return { expiresAt, cooldownSeconds: RESEND_COOLDOWN_SECONDS };
}

/**
 * Verify a submitted code. Throws with a specific error code on every
 * failure path so the route can return the right message without leaking
 * which part of the check failed to an attacker.
 */
async function verifyOtp({ userId, purpose, code }) {
  const otp = await Otp.findOne({ userId, purpose, consumed: false })
    .sort({ createdAt: -1 });

  if (!otp) {
    throw new OtpError('No active code found. Request a new one.', 'NOT_FOUND');
  }

  if (otp.expiresAt.getTime() < Date.now()) {
    otp.consumed = true;
    await otp.save();
    throw new OtpError('Code expired. Request a new one.', 'EXPIRED');
  }

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    otp.consumed = true;
    await otp.save();
    throw new OtpError('Too many incorrect attempts. Request a new one.', 'LOCKED');
  }

  if (otp.codeHash !== hashCode(String(code))) {
    otp.attempts += 1;
    await otp.save();
    const remaining = MAX_VERIFY_ATTEMPTS - otp.attempts;
    throw new OtpError(
      remaining > 0 ? `Incorrect code. ${remaining} attempt(s) left.` : 'Incorrect code.',
      'MISMATCH'
    );
  }

  otp.consumed = true;
  await otp.save();
  return true; // caller proceeds with whatever the OTP was gating
}

export { sendOtp, verifyOtp, OtpError };