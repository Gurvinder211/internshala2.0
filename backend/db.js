import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;

export function connect() {
    return mongoose.connect(url).then(() => {
        console.log("Database is connected");
    });
}