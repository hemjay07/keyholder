// GET /api/v1/programs/:id?day= : the full control record, its stage on every recorded day, and its changes.
import { handle, dayParam } from '@/lib/route';
import { latestDay, programRecord, stageHistory, changes } from '@/lib/records';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, '/api/v1/programs/[id]', async () => {
    const { id } = await params;
    const day = dayParam(req) ?? (await latestDay());
    const record = day ? await programRecord(id, day) : null;
    if (!record) return null;
    return { day, record, history: await stageHistory(id), changes: await changes({ programId: id, limit: 200 }) };
  });
}
export const dynamic = 'force-dynamic';
