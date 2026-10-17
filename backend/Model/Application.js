import { Schema, model } from "mongoose";
const Applicationipschema = new Schema({
  company: String,
  category: String,
  coverLetter: String,
  user: Object,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ["accepted", "pending", "rejected"],
    default: "pending",
  },
  Application: Object,
});
export default model("Application", Applicationipschema);
