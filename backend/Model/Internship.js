import { Schema, model } from "mongoose";
const Internshipschema = new Schema({
  title: String,
  company: String,
  location: String,
  category: String,
  aboutCompany: String,
  aboutInternship: String,
  whoCanApply: String,
  perks: Array,
  numberOfOpening: String,
  stipend: String,
  startDate: String,
  additionalInfo: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});
export default model("Internship",Internshipschema)
