// File: apps/web/src/app/api/v1/auth/signin/route.ts
// POST /api/v1/auth/signin { wallet, signature, nonceToken } -> sets the
// session cookie and returns the session JWT (also usable as a Bearer token).

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifySiwsAndIssueSession, sessionCookie } from '@/lib/auth';

const bodySchema = z.object({
  wallet: z.string().min(32).max(44),
  signature: z.string().min(1), // base64
  nonceToken: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, signature, nonceToken } = bodySchema.parse(body);

    const session = await verifySiwsAndIssueSession({ wallet, signature, nonceToken });
    if (!session) {
      return NextResponse.json(
        { data: null, error: { code: 'INVALID_SIGNATURE' } },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ data: { wallet, token: session }, error: null });
    res.headers.set('Set-Cookie', sessionCookie(session));
    return res;
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: String(error) } },
      { status: 400 }
    );
  }
}

export const dynamic = 'force-dynamic';
