import { Schema, model } from "mongoose";
const JobShcema = new Schema({
  title: String,
  company: String,
  location: String,
  Experience: String,
  category: String,
  aboutCompany: String,
  aboutJob: String,
  whoCanApply: String,
  perks: Array,
  AdditionalInfo: String,
  CTC: String,
  StartDate: String,
  createAt: {
    type: Date,
    default: Date.now,
  },
});
export default model("Job", JobShcema);
