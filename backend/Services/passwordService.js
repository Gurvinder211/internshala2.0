import { hash as _hash, compare } from 'bcrypt';
import { randomInt } from 'crypto';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const SALT_ROUNDS = 12;
const MIN_LENGTH = 8;

function validateStrength(password) {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include a number';
  return null; // null = valid
}

async function hashPassword(password) {
  return _hash(password, SALT_ROUNDS);
}

async function comparePassword(password, hash) {
  if (!hash) return false; // e.g. google-only account with no local password
  return compare(password, hash);
}
function generateResetPassword() {
  let pwd = '';
  for (let i = 0; i < RESET_PASSWORD_LENGTH; i++) {
    pwd += LETTERS[randomInt(0, LETTERS.length)];
  }
  return pwd;
}


export { validateStrength, hashPassword, comparePassword, generateResetPassword };