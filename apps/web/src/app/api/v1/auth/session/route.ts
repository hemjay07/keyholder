// File: apps/web/src/app/api/v1/auth/session/route.ts
// GET /api/v1/auth/session — current session, if any.

import { NextResponse } from 'next/server';
import { getWalletFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  const wallet = await getWalletFromRequest(req);
  if (!wallet) {
    return NextResponse.json({ data: null, error: { code: 'UNAUTHENTICATED' } }, { status: 401 });
  }
  return NextResponse.json({ data: { wallet }, error: null });
}

export const dynamic = 'force-dynamic';
