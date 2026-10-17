// Services/username.js
import User from '../Model/User.js';

export async function ensureUsername(user) {
  if (user.username) return user;
  const base = user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
  let candidate = base;
  let n = 0;
  while (await User.exists({ username: candidate, _id: { $ne: user._id } })) {
    n += 1;
    candidate = `${base}${n}`;
  }
  user.username = candidate;
  await user.save();
  return user;
}