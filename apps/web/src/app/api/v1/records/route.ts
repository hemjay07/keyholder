// GET /api/v1/records?day= : the day's header (summary, anchor, overlaps) and one row per program.
import { handle, dayParam } from '@/lib/route';
import { latestDay, dayHeader, registry } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/records', async () => {
    const day = dayParam(req) ?? (await latestDay());
    if (!day) return null;
    const header = await dayHeader(day);
    return header ? { ...header, programs: await registry(day) } : null;
  });
}
export const dynamic = 'force-dynamic';
