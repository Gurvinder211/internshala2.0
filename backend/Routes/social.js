import { Router } from 'express';
import protect from '../middleware/auth.js';
import User from '../Model/User.js';
import FriendRequest from '../Model/FriendRequest.js';
import Follow from '../Model/Follow.js';
import { notify } from '../Services/notify.js';
import { canPostToday, dailyLimitFor } from '../Services/postLimits.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = Router();

router.post('/friend-request/:userId', protect, async (req, res) => {
  const targetId = req.params.userId;
  if (targetId === String(req.user._id)) return res.status(400).json({ error: "Can't friend yourself" });
  if (req.user.friends.some((f) => String(f) === targetId)) {
    return res.status(409).json({ error: 'Already friends' });
  }

  const reverse = await FriendRequest.findOne({ fromUserId: targetId, toUserId: req.user._id, status: 'pending' });
  if (reverse) {
    // They already sent one — accept it instead of creating a duplicate.
    return acceptFriendRequest(req, res, reverse);
  }

  try {
    await FriendRequest.create({ fromUserId: req.user._id, toUserId: targetId });
    await notify({ userId: targetId, type: 'friend_request', fromUserId: req.user._id });
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Request already sent' });
    throw err;
  }
});

async function acceptFriendRequest(req, res, request) {
  request.status = 'accepted';
  await request.save();
  await User.updateOne({ _id: request.fromUserId }, { $addToSet: { friends: request.toUserId }, $inc: { friendCount: 1 } });
  await User.updateOne({ _id: request.toUserId }, { $addToSet: { friends: request.fromUserId }, $inc: { friendCount: 1 } });
  await notify({ userId: request.fromUserId, type: 'friend_accept', fromUserId: request.toUserId });
  res.json({ success: true });
}

router.post('/friend-request/:id/accept', protect, async (req, res) => {
  const request = await FriendRequest.findOne({ _id: req.params.id, toUserId: req.user._id, status: 'pending' });
  if (!request) return res.status(404).json({ error: 'Request not found' });
  await acceptFriendRequest(req, res, request);
});

router.post('/friend-request/:id/reject', protect, async (req, res) => {
  const request = await FriendRequest.findOneAndUpdate(
    { _id: req.params.id, toUserId: req.user._id, status: 'pending' },
    { $set: { status: 'rejected' } }
  );
  if (!request) return res.status(404).json({ error: 'Request not found' });
  res.json({ success: true });
});

router.delete('/friends/:userId', protect, async (req, res) => {
    const targetId = req.params.userId;
  const wereFriends = req.user.friends.some((f) => String(f) === targetId);
  if (!wereFriends) return res.status(404).json({ error: 'Not friends with this user' });

  await User.updateOne({ _id: req.user._id }, { $pull: { friends: targetId }, $inc: { friendCount: -1 } });
  await User.updateOne({ _id: targetId }, { $pull: { friends: req.user._id }, $inc: { friendCount: -1 } });
  await FriendRequest.deleteMany({
    $or: [{ fromUserId: req.user._id, toUserId: targetId }, { fromUserId: targetId, toUserId: req.user._id }],
  });
  res.json({ success: true });

});

router.get('/friend-requests', protect, async (req, res) => {
  const incoming = await FriendRequest.find({ toUserId: req.user._id, status: 'pending' }).populate('fromUserId', 'name photo username');
  res.json({ incoming });
});

router.post('/follow/:userId', protect, async (req, res) => {
  try {
    await Follow.create({ followerId: req.user._id, followingId: req.params.userId });
    await User.updateOne({ _id: req.user._id }, { $addToSet: { following: req.params.userId } });
    await User.updateOne({ _id: req.params.userId }, { $addToSet: { followers: req.user._id } });
    await notify({ userId: req.params.userId, type: 'follow', fromUserId: req.user._id });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'Already following' });
    throw err;
  }
});

router.delete('/follow/:userId', protect, async (req, res) => {
  await Follow.deleteOne({ followerId: req.user._id, followingId: req.params.userId });
  await User.updateOne({ _id: req.user._id }, { $pull: { following: req.params.userId } });
  await User.updateOne({ _id: req.params.userId }, { $pull: { followers: req.user._id } });
  res.json({ success: true });
});

router.get('/users/search', protect, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ users: [] });

    const re = new RegExp(escapeRegex(q), 'i');
    const found = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ username: re }, { name: re }],
    })
      .select('name username photo friendCount')
      .limit(20);

    const ids = found.map((u) => u._id);
    const pending = await FriendRequest.find({
      status: 'pending',
      $or: [
        { fromUserId: req.user._id, toUserId: { $in: ids } },
        { toUserId: req.user._id, fromUserId: { $in: ids } },
      ],
    });

    const sent = new Set(pending.filter((r) => r.fromUserId.equals(req.user._id)).map((r) => String(r.toUserId)));
    const received = new Map(
      pending.filter((r) => r.toUserId.equals(req.user._id)).map((r) => [String(r.fromUserId), r._id])
    );
    const friendSet = new Set(req.user.friends.map(String));

    const users = found.map((u) => {
      const id = String(u._id);
      let status = 'none';
      if (friendSet.has(id)) status = 'friend';
      else if (sent.has(id)) status = 'request_sent';
      else if (received.has(id)) status = 'request_received';
      return {
        _id: u._id, name: u.name, username: u.username, photo: u.photo,
        friendCount: u.friendCount, status,
        requestId: received.get(id) || null, // lets the UI accept straight from search
      };
    });

    res.json({ users });
  } catch (err) {
    console.error('user search failed:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// GET /api/social/friends
// Friend list, the count, and what the count means for posting.
router.get('/friends', protect, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).populate('friends', 'name username photo');
    const { limit, used } = await canPostToday(me._id, me.friendCount);
    res.json({
      friends: me.friends,
      friendCount: me.friendCount,
      posting: {
        dailyLimit: limit === Infinity ? null : limit, // null = unlimited
        postedToday: used,
      },
    });
  } catch (err) {
    console.error('friends list failed:', err);
    res.status(500).json({ error: 'Could not load friends' });
  }
});


export default router;