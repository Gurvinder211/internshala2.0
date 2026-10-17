// Model/Comment.js
import { Schema, model } from 'mongoose';

const commentSchema = new Schema({
  postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true, maxlength: 1000 },
  mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

commentSchema.index({ postId: 1, createdAt: -1 });

export default model('Comment', commentSchema);