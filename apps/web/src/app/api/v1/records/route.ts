// GET /api/v1/records?day= : the day's header (summary, anchor, overlaps) and one row per program.
// GET /api/v1/records?view=control : upgrade authority, multisig members and stage reason per program (Stage map picks).
import { handle, dayParam } from '@/lib/route';
import { latestDay, dayHeader, registry, controlIndex } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/records', async () => {
    const day = dayParam(req) ?? (await latestDay());
    if (!day) return null;
    if (new URL(req.url).searchParams.get('view') === 'control') return controlIndex(day);
    const header = await dayHeader(day);
    return header ? { ...header, programs: await registry(day) } : null;
  });
}
export const dynamic = 'force-dynamic';
