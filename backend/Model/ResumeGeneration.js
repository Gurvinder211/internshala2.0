import { Schema, model } from 'mongoose';

const resumeGenerationSchema = new Schema({
  resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  otpVerifiedAt: { type: Date, default: null }, // payment can't be initiated before this is set
  amount: { type: Number, default: 50 },

  razorpayOrderId: { type: String, default: null, unique: true, sparse: true },
  razorpayPaymentId: { type: String, default: null, index: { unique: true, sparse: true } },
  razorpaySignature: String,

  status: { type: String, enum: ['OTP_PENDING', 'OTP_VERIFIED', 'ORDER_CREATED', 'PAID', 'FAILED', 'CANCELLED'], default: 'OTP_PENDING' },
  failureReason: String,
  invoiceNumber: String,
  paidAt: Date,
  activated: { type: Boolean, default: false }, // PDF actually generated and linked yet?
}, { timestamps: true });

resumeGenerationSchema.index({ userId: 1, createdAt: -1 });

export default model('ResumeGeneration', resumeGenerationSchema);