import { Router } from 'express';
const router = Router();
import protect from '../middleware/auth.js';
import User from '../Model/User.js';
import LanguageChangeLog from '../Model/LanguageChangeLog.js';
import { sendOtp, verifyOtp, OtpError } from '../Services/otpService.js';
import { getClientContext } from '../Services/clientContext.js';

const SUPPORTED_LANGUAGES = ['en', 'es', 'hi', 'pt', 'zh', 'fr'];

function logChange(req, { fromLanguage, toLanguage, otpRequired, otpVerified }) {
  const ctx = getClientContext(req);
  return LanguageChangeLog.create({
    userId: req.user._id,
    fromLanguage,
    toLanguage,
    otpRequired,
    otpVerified,
    ...ctx,
  });
}

// PATCH /api/language
// Body: { language: 'es' }
// Applies immediately for every language except French.
router.patch('/', protect, async (req, res) => {
  try {
    const { language } = req.body;
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    if (language === 'fr') {
      // French requires OTP — don't apply yet, just tell the client to
      // start the verification flow.
      return res.status(409).json({
        error: 'OTP verification required to switch to French',
        code: 'OTP_REQUIRED',
      });
    }

    const fromLanguage = req.user.language;
    if (fromLanguage === language) {
      return res.status(200).json({ success: true, language }); // no-op, nothing to log
    }

    req.user.language = language;
    await req.user.save();
    await logChange(req, { fromLanguage, toLanguage: language, otpRequired: false, otpVerified: false });

    res.status(200).json({ success: true, language });
  } catch (error) {
    console.error('language patch failed:', error);
    res.status(500).json({ error: 'Could not update language' });
  }
});

// POST /api/language/french/request-otp
// Step 1 of the French-only flow.
router.post('/french/request-otp', protect, async (req, res) => {
  try {
    const { expiresAt, cooldownSeconds } = await sendOtp({
      userId: req.user._id,
      purpose: 'LANGUAGE_CHANGE',
      sentTo: req.user.email,
    });
    res.status(200).json({ success: true, expiresAt, cooldownSeconds });
  } catch (err) {
    if (err instanceof OtpError) {
      return res.status(429).json({ error: err.message, code: err.code });
    }
    console.error('french otp request failed:', err);
    res.status(500).json({ error: 'Could not send verification code' });
  }
});

// POST /api/language/french/verify-otp
// Step 2 — only this applies the change.
router.post('/french/verify-otp', protect, async (req, res) => {
  try {
    const { code } = req.body;
    await verifyOtp({ userId: req.user._id, purpose: 'LANGUAGE_CHANGE', code });

    const fromLanguage = req.user.language;
    req.user.language = 'fr';
    await req.user.save();
    await logChange(req, { fromLanguage, toLanguage: 'fr', otpRequired: true, otpVerified: true });

    res.status(200).json({ success: true, language: 'fr' });
  } catch (err) {
    if (err instanceof OtpError) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('french otp verify failed:', err);
    res.status(500).json({ error: 'Could not verify code' });
  }
}); 

export default router;