// GET /api/v1/claims?day= : every Proof of Control claim and whether the chain matched it that day.
import { handle, dayParam } from '@/lib/route';
import { latestDay, claimChecks } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/claims', async () => {
    const day = dayParam(req) ?? (await latestDay());
    return day ? { day, checks: await claimChecks(day) } : null;
  });
}
export const dynamic = 'force-dynamic';

/** POST /api/v1/claims { claim } : check a signed claim against the latest record now, without storing it.
 *  Publishing a claim (so it is checked every day and breaks join the feed) is a pull request adding it to data/claims. */
export async function POST(req: Request) {
  const { NextResponse } = await import('next/server');
  const { rateLimitByIp } = await import('@/lib/rate-limit');
  const { checkClaim, CLAIM_VERSION } = await import('@/lib/claims');
  const { latestDay, programRecord } = await import('@/lib/records');
  const limit = await rateLimitByIp(req);
  if (!limit.ok) return NextResponse.json({ data: null, error: { code: 'RATE_LIMITED' } }, { status: 429, headers: limit.headers });
  let claim: unknown;
  try { const b = (await req.json()) as { claim?: unknown }; claim = b.claim ?? b; } catch { /* below */ }
  const c = claim as { version?: string; programs?: { programId?: string }[]; signer?: string; signature?: string; protocol?: string } | undefined;
  if (!c || typeof c !== 'object' || !Array.isArray(c.programs) || !c.signer || !c.signature) {
    return NextResponse.json({ data: null, error: { code: 'BAD_CLAIM', message: `expected a signed ${CLAIM_VERSION} claim: { version, protocol, issuedAt, programs[], signer, signature }` } }, { status: 400, headers: limit.headers });
  }
  if (c.programs.length > 20) return NextResponse.json({ data: null, error: { code: 'BAD_CLAIM', message: 'at most 20 programs per claim' } }, { status: 400, headers: limit.headers });
  const day = await latestDay();
  if (!day) return NextResponse.json({ data: null, error: { code: 'NO_RECORD' } }, { status: 503, headers: limit.headers });
  const records = new Map();
  for (const p of c.programs) { if (typeof p?.programId === 'string') { const r = await programRecord(p.programId, day); if (r) records.set(p.programId, r); } }
  return NextResponse.json({ data: checkClaim(claim as never, day, records), error: null }, { headers: limit.headers });
}
