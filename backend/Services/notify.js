import Notification from '../Model/Notification.js';

export async function notify({ userId, type, fromUserId, postId = null }) {
  if (String(userId) === String(fromUserId)) return; // never notify yourself
  await Notification.create({ userId, type, fromUserId, postId });
}