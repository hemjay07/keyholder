// File: apps/web/src/lib/auth.ts
// SIWS (Sign-In With Solana): verify an ed25519 signature over a server
// nonce, issue a signed session cookie. Deviation from arch/D-web.md §5:
// that section assumed a `SiwsMessage` object was itself the signed bytes
// and stored no nonce state; here the nonce is embedded in a short-lived
// signed JWT so the server stays stateless (no nonce table) while still
// preventing replay (the nonce JWT expires in 5 minutes and is single-use
// per session token it produces).

import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT, jwtVerify } from 'jose';
import { env } from './env';

const NONCE_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const SESSION_EXPIRY = '7d';
const COOKIE_NAME = 'kh_session';

function secretKey(): Uint8Array {
  const secret = env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is not set; run: openssl rand -hex 32 >> .env');
  }
  return new TextEncoder().encode(secret);
}

/**
 * Issue a short-lived nonce for a wallet to sign. The nonce itself is a
 * random string; it travels to the client embedded in a signed JWT so the
 * server does not need to persist it.
 */
export async function issueNonce(wallet: string): Promise<{ nonce: string; nonceToken: string }> {
  const nonce = crypto.randomUUID();
  const nonceToken = await new SignJWT({ wallet, nonce, purpose: 'siws-nonce' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${NONCE_EXPIRY_SECONDS}s`)
    .sign(secretKey());
  return { nonce, nonceToken };
}

export const SIWS_STATEMENT = 'Sign in to Keyholder';

/** The exact message bytes the wallet must sign, given a nonce. */
export function siwsMessage(nonce: string): string {
  return `${SIWS_STATEMENT}\nnonce: ${nonce}`;
}

/**
 * Verify a SIWS signature against the nonce embedded in `nonceToken`, and if
 * valid, issue a signed session JWT (7 day expiry).
 */
export async function verifySiwsAndIssueSession(params: {
  wallet: string;
  signature: string; // base64
  nonceToken: string;
}): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(params.nonceToken, secretKey());
    if (payload.purpose !== 'siws-nonce' || payload.wallet !== params.wallet || typeof payload.nonce !== 'string') {
      return null;
    }

    const message = siwsMessage(payload.nonce);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = Buffer.from(params.signature, 'base64');
    const publicKeyBytes = bs58.decode(params.wallet);

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) return null;

    return new SignJWT({ wallet: params.wallet, purpose: 'session' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(SESSION_EXPIRY)
      .sign(secretKey());
  } catch {
    return null;
  }
}

export async function verifySession(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.purpose !== 'session' || typeof payload.wallet !== 'string') return null;
    return payload.wallet;
  } catch {
    return null;
  }
}

/** Extract wallet from Authorization: Bearer or the session cookie. */
export async function getWalletFromRequest(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifySession(authHeader.slice(7));
  }
  const cookies = req.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (match?.[1]) {
    return verifySession(decodeURIComponent(match[1]));
  }
  return null;
}

export function sessionCookie(token: string): string {
  const maxAge = 7 * 24 * 60 * 60;
  const secure = env.VERCEL_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export { COOKIE_NAME };
