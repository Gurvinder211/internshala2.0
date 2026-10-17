import { Schema, model } from 'mongoose';

const languageChangeLogSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fromLanguage: { type: String, required: true },
  toLanguage: { type: String, required: true },
  otpRequired: { type: Boolean, default: false },
  otpVerified: { type: Boolean, default: false },
  ip: String,
  browser: String,
  browserVersion: String,
  os: String,
  deviceType: String,
  deviceModel: String,
}, { timestamps: true });

languageChangeLogSchema.index({ userId: 1, createdAt: -1 });

export default model('LanguageChangeLog', languageChangeLogSchema);