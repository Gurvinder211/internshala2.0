import multer from 'multer';
import path from 'path';
import fs from 'fs';

const DIR = path.join(process.cwd(), 'storage', 'posts');
fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

export const uploadPostMedia = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => cb(null, ALLOWED.includes(file.mimetype)),
}).single('media');