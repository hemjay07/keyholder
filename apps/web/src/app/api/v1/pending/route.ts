// GET /api/v1/pending?program=&all=1 : open multisig proposals that would change control or move funds,
// with a plain-language explanation generated from the decoded facts.
import { handle } from '@/lib/route';
import { pendingActions } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/pending', async () => {
    const q = new URL(req.url).searchParams;
    return { pending: await pendingActions({ relevantOnly: q.get('all') !== '1', programId: q.get('program') ?? undefined, limit: Number(q.get('limit') ?? 100) || 100 }) };
  }, 120);
}
export const dynamic = 'force-dynamic';
