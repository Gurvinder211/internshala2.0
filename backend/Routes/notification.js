import { Router } from 'express';
import protect from '../middleware/auth.js';
import Notification from '../Model/Notification.js';

const router = Router();

router.get('/', protect, async (req, res) => {
  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 }).limit(50)
    .populate('fromUserId', 'name photo username');
  const unreadCount = await Notification.countDocuments({ userId: req.user._id, read: false });
  res.json({ notifications, unreadCount });
});

router.post('/read-all', protect, async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
  res.json({ success: true });
});

export default router;