import { Router } from 'express';
import protect from '../middleware/auth.js';
import { uploadPostMedia } from '../middleware/upload.js';
import rateLimit from 'express-rate-limit';
import Post from '../Model/Post.js';
import Comment from '../Model/Comment.js';
import User from '../Model/User.js';
import FriendRequest from '../Model/FriendRequest.js';
import { canPostToday } from '../Services/postLimits.js';
import { extractHashtags, extractMentions, isDuplicateRecent } from '../Services/postContent.js';
import { notify } from '../Services/notify.js';

const router = Router();
const EDIT_WINDOW_MINUTES = 15;
const REPORT_HIDE_THRESHOLD = 5;

const postLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 }); // blunt spam guard, on top of the daily quota

function withinEditWindow(post) {
  return Date.now() - post.createdAt.getTime() <= EDIT_WINDOW_MINUTES * 60 * 1000;
}

// ---- Create ----
router.post('/', protect, postLimiter, uploadPostMedia, async (req, res) => {
  try {
    const { content = '', privacy = 'public' } = req.body;
    if (!content.trim() && !req.file) {
      return res.status(400).json({ error: 'Post needs text, media, or both' });
    }

    const { allowed, limit, used } = await canPostToday(req.user._id, req.user.friendCount);
    if (!allowed) {
      return res.status(403).json({
        error: limit === 0
          ? 'Add at least one friend before you can post'
          : `You've reached today's post limit (${used}/${limit})`,
        code: 'POST_LIMIT',
      });
    }

    const mediaUrl = req.file ? `/uploads/posts/${req.file.filename}` : null;
    const mediaType = req.file ? (req.file.mimetype.startsWith('video') ? 'video' : 'image') : 'none';

    if (await isDuplicateRecent(req.user._id, content, mediaUrl)) {
      return res.status(409).json({ error: 'Looks like a duplicate of your last post', code: 'DUPLICATE' });
    }

    const mentions = await extractMentions(content);
    const post = await Post.create({
      userId: req.user._id,
      content,
      mediaUrl,
      mediaType,
      privacy,
      friendCountAtPost: req.user.friendCount,
      hashtags: extractHashtags(content),
      mentions,
    });

    mentions.forEach((uid) => notify({ userId: uid, type: 'mention', fromUserId: req.user._id, postId: post._id }));

    res.status(201).json({ post });
  } catch (err) {
    console.error('create post failed:', err);
    res.status(500).json({ error: 'Could not create post' });
  }
});

// ---- Edit / delete, within the time window ----
router.patch('/:id', protect, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!withinEditWindow(post)) {
    return res.status(403).json({ error: `Posts can only be edited within ${EDIT_WINDOW_MINUTES} minutes` });
  }
  if (typeof req.body.content === 'string') {
    post.content = req.body.content;
    post.hashtags = extractHashtags(req.body.content);
    post.mentions = await extractMentions(req.body.content);
    post.editedAt = new Date();
  }
  if (req.body.privacy) post.privacy = req.body.privacy;
  await post.save();
  res.json({ post });
});

router.delete('/:id', protect, async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, userId: req.user._id });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (!withinEditWindow(post)) {
    return res.status(403).json({ error: `Posts can only be deleted within ${EDIT_WINDOW_MINUTES} minutes` });
  }
  await Comment.deleteMany({ postId: post._id });
  await post.deleteOne();
  res.json({ success: true });
});

// ---- Engagement ----
router.post('/:id/like', protect, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const has = post.likes.some((id) => id.equals(req.user._id));
  await Post.updateOne({ _id: post._id }, has ? { $pull: { likes: req.user._id } } : { $addToSet: { likes: req.user._id } });
  if (!has) notify({ userId: post.userId, type: 'like', fromUserId: req.user._id, postId: post._id });
  res.json({ liked: !has });
});

router.post('/:id/save', protect, async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const has = post.saves.some((id) => id.equals(req.user._id));
  await Post.updateOne({ _id: post._id }, has ? { $pull: { saves: req.user._id } } : { $addToSet: { saves: req.user._id } });
  res.json({ saved: !has });
});

router.post('/:id/share', protect, async (req, res) => {
  const post = await Post.findByIdAndUpdate(req.params.id, { $inc: { shareCount: 1 } }, { new: true });
  if (!post) return res.status(404).json({ error: 'Post not found' });
  notify({ userId: post.userId, type: 'share', fromUserId: req.user._id, postId: post._id });
  res.json({ shareCount: post.shareCount });
});

router.post('/:id/report', protect, async (req, res) => {
  const { reason } = req.body;
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.reports.some((r) => r.userId.equals(req.user._id))) {
    return res.status(409).json({ error: 'You already reported this post' });
  }
  post.reports.push({ userId: req.user._id, reason });
  if (post.reports.length >= REPORT_HIDE_THRESHOLD) post.hidden = true;
  await post.save();
  res.json({ success: true });
});

// ---- Comments ----
router.post('/:id/comments', protect, postLimiter, async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  const post = await Post.findById(req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const mentions = await extractMentions(content);
  const comment = await Comment.create({ postId: post._id, userId: req.user._id, content, mentions });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });

  notify({ userId: post.userId, type: 'comment', fromUserId: req.user._id, postId: post._id });
  mentions.forEach((uid) => notify({ userId: uid, type: 'mention', fromUserId: req.user._id, postId: post._id }));

  res.status(201).json({ comment });
});

router.get('/:id/comments', protect, async (req, res) => {
  const cursor = req.query.cursor ? new Date(req.query.cursor) : new Date();
  const comments = await Comment.find({ postId: req.params.id, createdAt: { $lt: cursor } })
    .sort({ createdAt: -1 }).limit(20).populate('userId', 'name photo username');
  res.json({ comments, nextCursor: comments.length ? comments[comments.length - 1].createdAt : null });
});

export default router;