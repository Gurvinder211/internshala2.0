import { Router } from 'express';
import protect from '../middleware/auth.js';
import Post from '../Model/Post.js';

const router = Router();
const PAGE_SIZE = 10;

function visibleTo(user) {
  // public posts, or friends-only posts from someone you're actually friends with
  return {
    hidden: { $ne: true },
    $or: [{ privacy: 'public' }, { privacy: 'friends', userId: { $in: user.friends } }],
  };
}

// GET /api/feed?cursor=<ISO date>
router.get('/', protect, async (req, res) => {
  try {
    const cursor = req.query.cursor ? new Date(req.query.cursor) : new Date();
    const base = { ...visibleTo(req.user), createdAt: { $lt: cursor } };

    // Friends' posts first
    const friendsPosts = await Post.find({ ...base, userId: { $in: [...req.user.friends, req.user._id] } })
      .sort({ createdAt: -1 }).limit(PAGE_SIZE)
      .populate('userId', 'name photo username');

    const have = friendsPosts.length;
    let rest = [];
    if (have < PAGE_SIZE) {
      const excludeIds = friendsPosts.map((p) => p._id);
      // Trending: recent (last 3 days) ranked by engagement, then plain recent as filler
      const trending = await Post.aggregate([
        { $match: { ...base, _id: { $nin: excludeIds }, createdAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } } },
        { $addFields: { score: { $add: [{ $size: '$likes' }, { $multiply: ['$commentCount', 2] }, { $multiply: ['$shareCount', 3] }] } } },
        { $sort: { score: -1, createdAt: -1 } },
        { $limit: PAGE_SIZE - have },
      ]);
      const trendingIds = trending.map((p) => p._id);
      rest = await Post.populate(trending, { path: 'userId', select: 'name photo username' });

      if (rest.length < PAGE_SIZE - have) {
        const recent = await Post.find({ ...base, _id: { $nin: [...excludeIds, ...trendingIds] } })
          .sort({ createdAt: -1 }).limit(PAGE_SIZE - have - rest.length)
          .populate('userId', 'name photo username');
        rest = rest.concat(recent);
      }
    }

    const posts = [...friendsPosts, ...rest];
    res.json({ posts, nextCursor: posts.length ? posts[posts.length - 1].createdAt : null });
  } catch (err) {
    console.error('feed failed:', err);
    res.status(500).json({ error: 'Could not load feed' });
  }
});

export default router;