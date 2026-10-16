import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const [algorithm, encodedSalt, encodedHash] = storedHash.split(':');
  if (algorithm !== 'scrypt' || !encodedSalt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, 'base64url');
  if (expected.length !== 64) return false;
  const actual = await scrypt(password, Buffer.from(encodedSalt, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}
