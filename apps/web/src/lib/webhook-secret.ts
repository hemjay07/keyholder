// File: apps/web/src/lib/webhook-secret.ts
// Encrypts webhook signing secrets at rest (AES-256-GCM, keyed by
// SESSION_SECRET) so `webhooks.secret_enc` never stores plaintext. The
// plaintext secret is returned to the caller once, at creation time, exactly
// like Stripe/GitHub webhook secrets — it cannot be recovered after that.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env } from './env';

function key(): Buffer {
  const secret = env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]);
}

export function decryptSecret(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('hex')}`;
}
