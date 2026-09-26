// File: apps/web/src/app/api/x402/v1/state/route.ts
// POST /api/x402/v1/state — $0.05 historical control state at a given slot.

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { z } from 'zod';
import { fetchControlStateAtSlot } from '@/lib/api-client';
import { getX402Server, payToAddress, SOLANA_NETWORK_ID } from '@/lib/x402';

const bodySchema = z.object({ protocol: z.string(), slot: z.number() });

async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { protocol, slot } = bodySchema.parse(body);

    const state = await fetchControlStateAtSlot(protocol, slot);
    if (!state) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404 });
    }
    return NextResponse.json({ data: state, error: null });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: { code: 'INVALID_BODY', message: String(error) } },
      { status: 400 }
    );
  }
}

export const POST = withX402(
  handler,
  {
    accepts: {
      scheme: 'exact',
      payTo: payToAddress(),
      price: '$0.05',
      network: SOLANA_NETWORK_ID,
    },
    description: 'Keyholder historical control state at slot',
    mimeType: 'application/json',
  },
  getX402Server()
);

export const dynamic = 'force-dynamic';
