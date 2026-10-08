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
