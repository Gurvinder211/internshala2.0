import User from '../Model/User.js';
import Post from '../Model/Post.js';
import crypto from 'crypto';

export function extractHashtags(text) {
  return [...new Set((text.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.slice(1).toLowerCase()))];
}

export async function extractMentions(text) {
  const handles = [...new Set((text.match(/@[a-zA-Z0-9_]+/g) || []).map((m) => m.slice(1).toLowerCase()))];
  if (!handles.length) return [];
  const users = await User.find({ username: { $in: handles } }).select('_id');
  return users.map((u) => u._id);
}

// Same user posting identical text/media within a short window = likely a
// double-submit or spam, not a new post.
export async function isDuplicateRecent(userId, content, mediaUrl) {
  const hash = crypto.createHash('sha256').update(content + (mediaUrl || '')).digest('hex');
  const since = new Date(Date.now() - 2 * 60 * 1000);
  const recent = await Post.findOne({ userId, createdAt: { $gte: since } }).sort({ createdAt: -1 });
  if (!recent) return false;
  const recentHash = crypto.createHash('sha256').update(recent.content + (recent.mediaUrl || '')).digest('hex');
  return recentHash === hash;
}