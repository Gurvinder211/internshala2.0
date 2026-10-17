import express from 'express';
import User from '../Model/User.js';
import protect from '../middleware/auth.js';
import { validateStrength, hashPassword, comparePassword } from '../Services/passwordService.js';
import tokenService from '../Services/tokenService.js';
const { issueToken } = tokenService;

const router = express.Router();

router.get('/me', protect, (req, res) => {
  const user = req.user.toObject();
  delete user.passwordHash;
  delete user.__v;
  res.status(200).json({ user });
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    const strengthError = validateStrength(password);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      // Same message whether the email belongs to a google or local
      // account — don't reveal which, that's an enumeration leak.
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      authProvider: 'local',
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      emailVerified: false,
      language: 'en',
      subscription: { plan: 'FREE', quotaLimit: 1, quotaUsed: 0, cycleStartDate: new Date() },
    });

    const token = issueToken(user);
    res.status(201).json({ success: true, token, user: sanitize(user) });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateFields = Object.keys(error.keyPattern || error.keyValue || {});

      if (duplicateFields.includes('email')) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }
 
      console.error('register duplicate key conflict:', duplicateFields);
      return res.status(409).json({ error: 'Account details conflict with an existing account' });
    }
    console.error('register failed:', error);
    res.status(500).json({ error: 'Could not register' });
  }
}); 

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was.
    const invalid = () => res.status(401).json({ error: 'Invalid email or password' });

    if (!user || user.authProvider !== 'local') return invalid();

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) return invalid();

    const token = issueToken(user);
    res.status(200).json({
      success: true,
      token,
      user: sanitize(user),
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    console.error('login failed:', error);
    res.status(500).json({ error: 'Could not log in' });
  }
});

router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }

    const ok = await comparePassword(currentPassword, req.user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const strengthError = validateStrength(newPassword);
    if (strengthError) {
      return res.status(400).json({ error: strengthError });
    }

    req.user.passwordHash = await hashPassword(newPassword);
    req.user.mustChangePassword = false;
    await req.user.save();

    res.status(200).json({ success: true, message: 'Password updated' });
  } catch (err) {
    console.error('change-password failed:', err);
    res.status(500).json({ error: 'Could not update password' });
  }
});


function sanitize(user) {
  const obj = user.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
}

export default router;