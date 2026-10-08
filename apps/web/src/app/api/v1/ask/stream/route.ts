// POST /api/v1/ask/stream { question, history? } : Ask Keyholder as server-sent events (design/ASK-PLAN.md).
// Events: instant (a name or address resolved from the record, no model) | step (a record read) | answer (structured)
// | cards (compact control cards for the programs named) | text (unstructured fallback) | error | done.
import Anthropic from '@anthropic-ai/sdk';
import { askStream, MAX_QUESTION_CHARS, type AskEvent } from '@/lib/ask';
import { resolveInstant, programCards, coveredIds } from '@/lib/ask-resolve';
import { latestDay } from '@/lib/records';
import { rateLimitByIp } from '@/lib/rate-limit';

interface Body { question?: unknown; history?: unknown }

export async function POST(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) return Response.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  let body: Body = {};
  try { body = (await req.json()) as Body; } catch { /* handled below */ }
  const question = String(body.question ?? '').trim();
  if (!question || question.length > MAX_QUESTION_CHARS) return Response.json({ data: null, error: { code: 'BAD_QUESTION' } }, { status: 400, headers: limit.headers });
  const history = Array.isArray(body.history)
    ? (body.history as { q?: unknown; a?: unknown }[]).filter((h) => typeof h?.q === 'string' && typeof h?.a === 'string').map((h) => ({ q: String(h.q).slice(0, 600), a: String(h.a).slice(0, 1200) }))
    : [];

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (e: AskEvent | { type: string; [k: string]: unknown }) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const instant = history.length ? null : await resolveInstant(question);
        if (instant) { send({ type: 'instant', resolved: instant }); return; }
        const day = await latestDay();
        let answerIds: string[] = [];
        await askStream(question, history, (e) => { if (e.type === 'answer') answerIds = e.answer.programIds; send(e); });
        if (day && answerIds.length) {
          const covered = await coveredIds(day);
          const cards = await programCards(answerIds.filter((id) => covered.has(id)), day);
          if (cards.length) send({ type: 'cards', cards });
        }
      } catch (error) {
        const noCredit = error instanceof Anthropic.APIError && /credit balance/i.test(error.message);
        const code = noCredit ? 'MODEL_OFFLINE' : error instanceof Anthropic.RateLimitError ? 'MODEL_BUSY' : error instanceof Anthropic.APIError ? 'MODEL_ERROR' : 'SERVER_ERROR';
        if (code !== 'MODEL_BUSY') console.error('POST /api/v1/ask/stream failed', error instanceof Anthropic.APIError ? `${error.status} ${error.message}` : error);
        send({ type: 'error', code });
      } finally {
        send({ type: 'done' });
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { ...limit.headers, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
}
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
