import { Schema, model } from 'mongoose';

// Define a sub-schema for structured subscription data
const subscriptionSchema = new Schema({
  plan: {
    type: String,
    enum: ['FREE', 'BRONZE', 'SILVER', 'GOLD', null],
    default: null,
  },
  validTill: { type: Date, default: null },
  cycleStartDate: { type: Date, default: Date.now }, // for monthly quota reset
  quotaUsed: { type: Number, default: 0 },
  quotaLimit: { type: Number, default: 1 } // Free = 1/month
}, { _id: false }); // Prevents Mongoose from generating an auto-_id for this sub-document

// Main User Schema definition
const userSchema = new Schema({
  // --- IDENTITY FIELDS ---
  authProvider: {
  type: String,
  enum: ['google', 'local'],
  required: true,
  },
  firebaseUid: {
    type: String,
    required: function () {
      return this.authProvider === 'google';
    },
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  username: {
  type: String,
  unique: true,
  sparse: true, // backfilled lazily below, not required on existing docs immediately
  trim: true,
  lowercase: true,
  },
  phone: {
    type: String,
    default: null,
    trim: true
  },
  photo: {
    type: String,
    default: null
  },
  passwordHash: {
    type: String,
    default: null // Can be null if users only sign in via Firebase Auth
  },
  mustChangePassword: {
    type: Boolean,
    default: false
  },

  // --- FEATURE FIELDS ---
  language: {
    type: String,
    enum: ['en', 'es', 'hi', 'pt', 'zh', 'fr'], // Replace with your exact 6 language codes
    default: 'en'
  },
  subscription: {
    type: subscriptionSchema,
    default: () => ({}) // Forces instantiation of defaults
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  defaultResumeId: {
    type: Schema.Types.ObjectId,
    ref: 'Resume', // Assumes a Resume model exists
    default: null
  },
  friends: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  friendCount: {
    type: Number,
    default: 0
  },
  followers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  trustedDevices: [{
    deviceId: String,
    deviceName: String,
    lastUsedAt: { type: Date, default: Date.now }
  }],
  lastPasswordResetAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Automatically creates createdAt and updatedAt fields
});

// --- INDEXES ---
// Unique indexes explicitly added for lookup performance optimization
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ firebaseUid: 1 }, { unique: true, sparse: true }); // Sparse allows for null values in firebaseUid

const User = model('User', userSchema);

export default User;
