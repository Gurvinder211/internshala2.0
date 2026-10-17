// Model/Transaction.js
import { Schema, model } from 'mongoose';

const transactionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  plan: { type: String, enum: ['BRONZE', 'SILVER', 'GOLD'], required: true },
  action: { type: String, enum: ['PURCHASE', 'UPGRADE', 'RENEW'], required: true },
  amount: { type: Number, required: true },          // rupees
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['CREATED', 'PAID', 'FAILED', 'CANCELLED'], default: 'CREATED' },
  failureReason: { type: String, default: null },

  razorpayOrderId: { type: String, required: true, unique: true },
  razorpayPaymentId: { type: String, index: { unique: true, sparse: true } },
  razorpaySignature: { type: String },

  invoiceNumber: { type: String, default: null },
  paidAt: { type: Date, default: null },
  validFrom: { type: Date, default: null },
  validTill: { type: Date, default: null },
  activated: { type: Boolean, default: false }, // plan applied to the user yet?

  billing: { name: String, email: String },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });

export default model('Transaction', transactionSchema);