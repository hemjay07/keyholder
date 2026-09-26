// File: apps/worker/src/alert-dispatcher/webhook-secret.ts
// Decrypts `webhooks.secret_enc`, written by apps/web/src/lib/webhook-secret.ts.
// Same algorithm (AES-256-GCM, key = sha256(SESSION_SECRET)) so ciphertext
// written by the web layer is readable here — SESSION_SECRET lives in the
// shared root .env both apps load (see apps/worker/src/migrate.ts's dotenv
// pattern), not duplicated as a separate secret.

import { createDecipheriv, createHash } from 'node:crypto';

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return createHash('sha256').update(secret).digest();
}

export function decryptWebhookSecret(blob: Buffer): string {
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const ciphertext = blob.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
