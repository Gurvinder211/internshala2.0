import { Router } from 'express';
const router = Router();
import User from '../Model/User.js';
import PasswordResetLog from '../Model/PasswordResetLog.js';
import { sendOtp, verifyOtp, OtpError } from '../Services/otpService.js';
import { generateResetPassword, hashPassword } from '../Services/passwordService.js';
import { getClientContext } from '../Services/clientContext.js';
import { sendMail } from '../Services/mailer.js';

const RESET_COOLDOWN_HOURS = 24;

// POST /api/password-reset/request
// Body: { email }
router.post('/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Don't reveal whether the account exists — same response either way.
    const genericOk = () =>
      res.status(200).json({
        success: true,
        message: 'If an account exists for this email, a reset code has been sent.',
      });

    if (!user) return genericOk();

    if (user.lastPasswordResetAt) {
      const hoursSince = (Date.now() - user.lastPasswordResetAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < RESET_COOLDOWN_HOURS) {
        return res.status(429).json({
          error: 'You can use this option only once per day.',
          code: 'DAILY_LIMIT',
        });
      }
    }

    await sendOtp({ userId: user._id, purpose: 'PASSWORD_RESET', sentTo: user.email });

    const ctx = getClientContext(req);
    await PasswordResetLog.create({
      userId: user._id,
      method: 'email',
      verified: false,
      ...ctx,
    });

    return genericOk();
  } catch (err) {
    if (err instanceof OtpError) {
      // Cooldown/daily-cap from the OTP service itself (separate from the
      // 24h reset-request limit above — this one guards the code, not the reset).
      return res.status(429).json({ error: err.message, code: err.code });
    }
    console.error('password-reset request failed:', err);
    res.status(500).json({ error: 'Could not process request' });
  }
});

// POST /api/password-reset/verify
// Body: { email, code }
router.post('/verify', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email and code are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Generic — same shape as a wrong code, don't leak account existence.
      return res.status(400).json({ error: 'Invalid code' });
    }

    await verifyOtp({ userId: user._id, purpose: 'PASSWORD_RESET', code });

    const newPassword = generateResetPassword();
    user.passwordHash = await hashPassword(newPassword);
    user.mustChangePassword = true;
    user.lastPasswordResetAt = new Date();
    user.authProvider = user.authProvider === 'google' ? 'local' : user.authProvider;
    // ^ if a Google-only user resets via email, they now also have a local
    // password — flip them to a state where email+password login works too.
    // Drop this line if you want reset to be local-accounts-only.
    await user.save();

    await PasswordResetLog.updateOne(
      { userId: user._id, verified: false },
      { $set: { verified: true } },
      { sort: { createdAt: -1 } }
    );

    await sendMail({
      to: user.email,
      subject: 'Your new password',
      text: `Your password has been reset. Your new temporary password is:\n\n${newPassword}\n\nYou'll be asked to change it right after you log in. If you didn't request this, contact support immediately.`,
      html: `<p>Your password has been reset. Your new temporary password is:</p><h2 style="letter-spacing:2px">${newPassword}</h2><p>You'll be asked to change it right after you log in. If you didn't request this, contact support immediately.</p>`,
    });

    res.status(200).json({
      success: true,
      message: 'A new password has been sent to your email.',
    });
  } catch (err) {
    if (err instanceof OtpError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('password-reset verify failed:', err);
    res.status(500).json({ error: 'Could not reset password' });
  }
});

export default router;