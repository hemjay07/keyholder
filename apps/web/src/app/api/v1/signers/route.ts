// GET /api/v1/signers?day=&limit= : keys ranked by the $ behind them.
import { handle, dayParam } from '@/lib/route';
import { latestDay, topSigners } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/signers', async () => {
    const day = dayParam(req) ?? (await latestDay());
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? 50) || 50, 500);
    return day ? { day, signers: await topSigners(day, limit) } : null;
  });
}
export const dynamic = 'force-dynamic';
