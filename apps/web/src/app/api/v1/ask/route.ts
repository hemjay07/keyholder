// POST /api/v1/ask { question } : Ask Keyholder. Answers come only from Control Record tool results.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ask, MAX_QUESTION_CHARS } from '@/lib/ask';
import { rateLimitByIp } from '@/lib/rate-limit';

export async function POST(req: Request) {
  const limit = await rateLimitByIp(req);
  if (!limit.ok) return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  let question = '';
  try { question = String(((await req.json()) as { question?: unknown }).question ?? '').trim(); } catch { /* handled below */ }
  if (!question || question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json({ data: null, error: { code: 'BAD_QUESTION', message: `ask a question of 1 to ${MAX_QUESTION_CHARS} characters` } }, { status: 400, headers: limit.headers });
  }
  try {
    return NextResponse.json({ data: await ask(question), error: null }, { headers: limit.headers });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return NextResponse.json({ data: null, error: { code: 'MODEL_BUSY' } }, { status: 503, headers: limit.headers });
    if (error instanceof Anthropic.APIError) {
      console.error('POST /api/v1/ask model error', error.status, error.message);
      return NextResponse.json({ data: null, error: { code: 'MODEL_ERROR' } }, { status: 502, headers: limit.headers });
    }
    console.error('POST /api/v1/ask failed', error);
    return NextResponse.json({ data: null, error: { code: 'SERVER_ERROR' } }, { status: 500, headers: limit.headers });
  }
}
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
