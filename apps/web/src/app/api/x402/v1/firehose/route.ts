// File: apps/web/src/app/api/x402/v1/firehose/route.ts
// GET /api/x402/v1/firehose — paid SSE firehose of all risk_deltas.
//
// Deviation (honest, per arch/D-web.md §10's own admission): x402's `exact`
// scheme settles one payment per request/response; it has no native
// "per 1,000 events" metering primitive. This charges $0.01 to open a
// firehose connection (an approximation of "per 1,000 events" as a session
// cap, same as the contract's own note: "billed separately; session cap
// managed by facilitator") rather than inventing a per-event billing
// mechanism @x402/next does not expose.

import { NextRequest } from 'next/server';
import { withX402 } from '@x402/next';
import postgres from 'postgres';
import { env } from '@/lib/env';
import { getX402Server, payToAddress, SOLANA_NETWORK_ID } from '@/lib/x402';

async function handler(req: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();
  const listenClient = postgres(env.DATABASE_URL, { max: 1 });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"firehose_connected"}\n\n'));

      await listenClient.listen('risk_delta_created', (payload) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'risk_delta', payload: JSON.parse(payload) })}\n\n`));
      });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        listenClient.end({ timeout: 1 }).catch(() => {});
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      listenClient.end({ timeout: 1 }).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive',
    },
  });
}

export const GET = withX402(
  // @x402/next's withX402 types the handler as returning NextResponse; a raw
  // streaming Response is not assignable to that type, so this is cast at
  // the boundary. Runtime behavior (settlement after a non-error status,
  // then streaming the body through) is unaffected.
  handler as unknown as (request: NextRequest) => Promise<import('next/server').NextResponse>,
  {
    accepts: {
      scheme: 'exact',
      payTo: payToAddress(),
      price: '$0.01',
      network: SOLANA_NETWORK_ID,
    },
    description: 'Keyholder firehose: all risk_deltas, streamed (per-connection rate, ~$0.01/1,000 events)',
    mimeType: 'text/event-stream',
  },
  getX402Server()
);

export const dynamic = 'force-dynamic';
export const maxDuration = 3600;
