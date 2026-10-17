// Model/Post.js
import { Schema, model } from 'mongoose';

const postSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, maxlength: 3000, default: '' },
  mediaUrl: { type: String, default: null },
  mediaType: { type: String, enum: ['none', 'image', 'video'], default: 'none' },
  privacy: { type: String, enum: ['public', 'friends'], default: 'public' },

  friendCountAtPost: { type: Number, required: true }, // historical, per spec
  hashtags: [{ type: String, lowercase: true, index: true }],
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],

  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  saves: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  shareCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 }, // denormalized; Comment is its own collection
  viewCount: { type: Number, default: 0 },

  reports: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, reason: String, createdAt: { type: Date, default: Date.now } }],
  hidden: { type: Boolean, default: false }, // auto-hidden past a report threshold

  editedAt: { type: Date, default: null },
}, { timestamps: true });

postSchema.index({ userId: 1, createdAt: -1 });
postSchema.index({ privacy: 1, createdAt: -1 });
postSchema.index({ hashtags: 1 });

export default model('Post', postSchema);