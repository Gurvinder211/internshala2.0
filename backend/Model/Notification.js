// Model/Notification.js
import { Schema, model } from 'mongoose';

const notificationSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // recipient
  type: { type: String, enum: ['like', 'comment', 'share', 'friend_request', 'friend_accept', 'mention', 'follow'], required: true },
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  postId: { type: Schema.Types.ObjectId, ref: 'Post', default: null },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, createdAt: -1 });

export default model('Notification', notificationSchema);