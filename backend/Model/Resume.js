import { Schema, model } from 'mongoose';

const resumeSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, default: 'Untitled Resume' }, // e.g. "SDE Intern v2"

  template: { type: String, enum: ['classic', 'modern', 'minimal'], default: 'classic' },
  themeColor: { type: String, default: '#2563eb' },
  fontFamily: { type: String, enum: ['Helvetica', 'Times-Roman', 'Courier'], default: 'Helvetica' },

  personal: {
    fullName: String, email: String, phone: String, location: String,
    photoUrl: String, careerObjective: String,
  },
  education: [{ degree: String, institution: String, startYear: String, endYear: String, grade: String }],
  experience: [{ title: String, company: String, startDate: String, endDate: String, description: String }],
  internships: [{ role: String, company: String, startDate: String, endDate: String, description: String }],
  projects: [{ name: String, description: String, link: String }],
  certifications: [{ name: String, issuer: String, year: String }],
  achievements: [String],
  skills: [String],
  languages: [{ name: String, proficiency: String }],
  socialLinks: { linkedin: String, github: String, portfolio: String },
  references: [{ name: String, contact: String, relation: String }],

  status: { type: String, enum: ['draft', 'generated'], default: 'draft' },
  pdfUrl: { type: String, default: null },
  pdfGeneratedAt: { type: Date, default: null },
  paid: { type: Boolean, default: false }, // has ANY generation ever been paid for
}, { timestamps: true });

resumeSchema.index({ userId: 1, createdAt: -1 });

export default model('Resume', resumeSchema);