import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import User from '../Model/User.js';

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }
    const token = authHeader.split(' ')[1];

    let user = await tryFirebase(token);
    if (!user) user = await tryLocalJwt(token);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth Middleware Error:', error);
    return res.status(401).json({ message: 'Unauthorized: Invalid token.' });
  }
};

async function tryFirebase(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    const { uid, name, email, email_verified, picture } = decoded;
    const normalizedEmail = email.toLowerCase();

    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = await User.findOneAndUpdate(
        { email: normalizedEmail },
        {
          $setOnInsert: { authProvider: 'google', passwordHash: null, mustChangePassword: false },
          $set: {
            firebaseUid: uid,
            name: name || normalizedEmail.split('@')[0],
            emailVerified: email_verified || false,
            photo: picture || null,
          },
        },
        { new: true, upsert: true, runValidators: true }
      );
    } else {
      const changed =
        (name && user.name !== name) ||
        user.emailVerified !== !!email_verified ||
        (picture && user.photo !== picture);
      if (changed) {
        user.name = name || user.name;
        user.emailVerified = email_verified || user.emailVerified;
        user.photo = picture || user.photo;
        await user.save();
      }
    }
    return user;
  } catch {
    return null; // not a valid Firebase token — let the JWT path try
  }
}

async function tryLocalJwt(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    return user || null;
  } catch {
    return null; // not a valid local token either — caller returns 401
  }
}

export default protect;