import { Schema, model } from 'mongoose';

const otpSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  purpose: {
    type: String,
    enum: ['LANGUAGE_CHANGE', 'RESUME_PAYMENT', 'PASSWORD_RESET', 'LOGIN_VERIFY'],
    required: true,
  },
  codeHash: {
    type: String,
    required: true,
  },
  sentTo: {
    // email address or phone number the code was actually sent to —
    // kept separate from user.email/user.phone in case either changes later
    type: String,
    required: true,
  },
  channel: {
    type: String,
    enum: ['email', 'sms'],
    default: 'email',
  },
  attempts: {
    type: Number,
    default: 0,
  },
  consumed: {
    type: Boolean,
    default: false,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

// TTL index: Mongo automatically deletes the document once expiresAt passes.
// This does NOT stop verification before then — that's enforced in the
// service layer — it just keeps the collection from growing forever.
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Fast lookup for "does this user have a live OTP for this purpose"
// and for resend-cooldown / daily-cap queries.
otpSchema.index({ userId: 1, purpose: 1, createdAt: -1 });

export default model('Otp', otpSchema);