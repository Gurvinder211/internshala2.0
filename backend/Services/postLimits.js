import Post from '../Model/Post.js';

// upper bound of each bracket -> posts/day allowed; Infinity for >10 friends
const TIERS = [
  { maxFriends: 0, limit: 0 },
  { maxFriends: 1, limit: 1 },
  { maxFriends: 5, limit: 2 },
  { maxFriends: 10, limit: 5 },
  { maxFriends: Infinity, limit: Infinity },
];

export function dailyLimitFor(friendCount) {
  return TIERS.find((t) => friendCount <= t.maxFriends).limit;
}

function startOfTodayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function canPostToday(userId, friendCount) {
  const limit = dailyLimitFor(friendCount);
  if (limit === Infinity) return { allowed: true, limit, used: null };
  if (limit === 0) return { allowed: false, limit, used: 0 };

  const used = await Post.countDocuments({ userId, createdAt: { $gte: startOfTodayUTC() } });
  return { allowed: used < limit, limit, used };
}