// File: apps/web/src/app/api/x402/v1/check/route.ts
// POST /api/x402/v1/check — $0.01 policy check, paid via x402 (PayAI
// facilitator, no key needed). See lib/x402.ts for how the real installed
// @x402/next + @x402/svm API differs from arch/D-web.md §10's pseudo-code.

import { NextRequest, NextResponse } from 'next/server';
import { withX402 } from '@x402/next';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { toControlFacts, type StoredControlState } from '@/lib/control';
import { getX402Server, payToAddress, SOLANA_NETWORK_ID } from '@/lib/x402';
import { desc, eq } from 'drizzle-orm';

const bodySchema = z.object({ protocol: z.string() });

async function handler(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { protocol } = bodySchema.parse(body);

    const db = getDb();
    const [state] = await db
      .select()
      .from(schema.control_state)
      .where(eq(schema.control_state.protocol_id, protocol))
      .orderBy(desc(schema.control_state.slot))
      .limit(1);

    if (!state) {
      return NextResponse.json({ data: null, error: { code: 'NOT_FOUND' } }, { status: 404 });
    }

    const facts = toControlFacts(state.state as StoredControlState);
    return NextResponse.json({ data: { protocol, slot: state.slot, ...facts }, error: null });
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
      price: '$0.01',
      network: SOLANA_NETWORK_ID,
    },
    description: 'Keyholder control-state policy check',
    mimeType: 'application/json',
  },
  getX402Server()
);

export const dynamic = 'force-dynamic';
