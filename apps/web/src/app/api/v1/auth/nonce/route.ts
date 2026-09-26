// File: apps/web/src/app/api/v1/auth/nonce/route.ts
// POST /api/v1/auth/nonce { wallet } -> { nonce, nonceToken, message }
// The wallet signs `message` (see lib/auth.ts siwsMessage) and posts the
// signature + nonceToken to /api/v1/auth/signin.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { issueNonce, siwsMessage } from '@/lib/auth';

const bodySchema = z.object({ wallet: z.string().min(32).max(44) });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet } = bodySchema.parse(body);
    const { nonce, nonceToken } = await issueNonce(wallet);
    return NextResponse.json({ data: { nonce, nonceToken, message: siwsMessage(nonce) }, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: String(error) } },
      { status: 400 }
    );
  }
}

export const dynamic = 'force-dynamic';
