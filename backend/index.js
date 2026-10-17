import express from "express";
const app = express();
import cors from "cors";
import { connect } from "./db.js";
import router from "./Routes/index.js";
import { createRequire } from 'module';
import { initializeApp, cert } from 'firebase-admin/app';
import path from 'path';


// Enable JSON loading in ES Modules
const require = createRequire(import.meta.url);
const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount)
});

const port = 5000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (req, res) => {
  res.send("hello this is internshala backend");
});
app.use("/api", router);
connect();
app.use((req, res, next) => {
  req.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "*");
  next();
});
app.use('/uploads/posts', express.static(path.join(process.cwd(), 'storage', 'posts')));
app.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
});
