// GET /api/v1/stages : the published rules (same package and version the records are graded with) and today's counts.
import { RULES_VERSION, STAGE_RULES, STAGE_2_MIN_DELAY_S, STAGE_3_MIN_DELAY_S } from '@keyholder/stages';
import { handle } from '@/lib/route';
import { latestDay, dayHeader } from '@/lib/records';

export async function GET(req: Request) {
  return handle(req, '/api/v1/stages', async () => {
    const day = await latestDay();
    const header = day ? await dayHeader(day) : null;
    return { version: RULES_VERSION, thresholds: { stage2MinDelayS: STAGE_2_MIN_DELAY_S, stage3MinDelayS: STAGE_3_MIN_DELAY_S }, rules: STAGE_RULES, day, summary: header?.summary ?? null };
  }, 300);
}
export const dynamic = 'force-dynamic';
