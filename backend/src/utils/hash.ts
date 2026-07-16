import crypto from 'crypto';

/** Returns the lowercase hex SHA-256 digest of a buffer (no 0x prefix). */
export function sha256Hex(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}
