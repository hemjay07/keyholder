// GET /api/v1/changes?since=&until=&program=&kind=&limit= : the control feed, newest first.
import { handle } from '@/lib/route';
import { changes } from '@/lib/records';

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

export async function GET(req: Request) {
  return handle(req, '/api/v1/changes', async () => {
    const q = new URL(req.url).searchParams;
    return { events: await changes({ since: day(q.get('since')), until: day(q.get('until')), programId: q.get('program') ?? undefined, kind: q.get('kind') ?? undefined, limit: Number(q.get('limit') ?? 200) || 200 }) };
  }, 30);
}
export const dynamic = 'force-dynamic';
