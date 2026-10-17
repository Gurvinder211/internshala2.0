import jsonwebtoken from 'jsonwebtoken';

const { sign, verify } = jsonwebtoken;

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set in the environment');
}

function issueToken(user) { 
  return sign(
    { sub: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  return verify(token, JWT_SECRET); // throws on invalid/expired
}

export default { issueToken, verifyToken };