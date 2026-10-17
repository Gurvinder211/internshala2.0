import { Schema, model } from 'mongoose';

const passwordResetLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  method: {
    type: String,
    enum: ['email', 'sms'],
    required: true,
  },
  requestedAt: {
    type: Date,
    default: Date.now,
  },
  verified: {
    type: Boolean,
    default: false,
  },
  ip: String,
  browser: String,
  browserVersion: String,
  os: String,
  deviceType: String,
  deviceModel: String,
}, { timestamps: true });

passwordResetLogSchema.index({ userId: 1, createdAt: -1 });

export default model('PasswordResetLog', passwordResetLogSchema);
