// Model/Follow.js — one-directional, separate from mutual friendship
import { Schema, model } from 'mongoose';

const followSchema = new Schema({
  followerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  followingId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

followSchema.index({ followerId: 1, followingId: 1 }, { unique: true });

export default model('Follow', followSchema);