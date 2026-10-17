// Model/FriendRequest.js
import { Schema, model } from 'mongoose';

const friendRequestSchema = new Schema({
  fromUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  toUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { timestamps: true });

// one live request per direction
friendRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

export default model('FriendRequest', friendRequestSchema);