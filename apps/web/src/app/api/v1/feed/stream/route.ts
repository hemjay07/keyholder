// File: apps/web/src/app/api/v1/feed/stream/route.ts
// GET /api/v1/feed/stream — SSE fed from the worker via Postgres
// LISTEN/NOTIFY. Deviation from arch/D-web.md §9: that section's stream sent
// only a heartbeat and never actually listened for anything; this opens a
// dedicated `postgres` connection (LISTEN requires its own connection, not
// the pooled query client) subscribed to the `risk_delta_created` channel
// installed by drizzle/20260926181023_risk_delta_notify.sql, and closes it
// when the client disconnects.

import postgres from 'postgres';
import { env } from '@/lib/env';

export async function GET(req: Request) {
  const encoder = new TextEncoder();
  const listenClient = postgres(env.DATABASE_URL, { max: 1 });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"connected"}\n\n'));

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

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
