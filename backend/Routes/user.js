import { Router } from 'express';
const router = Router();
import protect from '../middleware/auth.js';

// POST /api/user/sync
// Frontend calls this right after Firebase login
router.post('/sync', protect, async (req, res) => {
  try {
    // The protect middleware has already validated the token 
    // and fetched/created the user in req.user
    
    res.status(200).json({
      success: true,
      message: 'User synced successfully.',
      user: {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    photo: req.user.photo,
    language: req.user.language,
    isPremium: req.user.isPremium,
    subscription: req.user.subscription,
    friendCount: req.user.friendCount,
    mustChangePassword: req.user.mustChangePassword,

      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error syncing user.' });
  }
});

export default router;
