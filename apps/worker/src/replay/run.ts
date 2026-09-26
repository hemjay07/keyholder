// File: apps/worker/src/replay/run.ts
// Task 3.3 VERIFY: runs the real Drift replay, stores it (replay_runs /
// replay_alerts), and prints the frame summary + measured lead time.
//
// Usage: `pnpm --filter @keyholder/worker exec tsx src/replay/run.ts`
// Requires DATABASE_URL.

import * as dotenv from 'dotenv';
import { join } from 'node:path';
dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

import { initDb } from '../db';
import { replayDriftIncident } from './drift-replay';
import { storeReplayRun } from './store';

async function main(): Promise<void> {
  const db = initDb();
  const result = replayDriftIncident();

  console.log(`[replay] ${result.frames.length} frames (${result.frames.filter((f) => !f.isGapFrame).length} real, ${result.frames.filter((f) => f.isGapFrame).length} gap):`);
  for (const f of result.frames) {
    const deltas = f.deltasFired.map((d) => `${d.ruleId}:${d.severity}`).join(', ') || '(none)';
    console.log(`  step ${f.step} slot ${f.slot} ${f.time} — ${f.label}${f.isGapFrame ? '' : ` — deltas: ${deltas}`}`);
  }

  console.log(
    `[replay] POSTURE at window start (not an alert): ${result.postureAtWindowStart.map((d) => `${d.ruleId}:${d.severity} — ${d.explanation}`).join('; ') || '(none)'}`
  );
  console.log(
    `[replay] FIRST TRANSITION ALERT: step ${result.firstTransitionAlert?.frame.step} (${result.firstTransitionAlert?.delta.ruleId}, ${result.firstTransitionAlert?.delta.severity}) at ${result.firstTransitionAlert?.frame.time}`
  );
  console.log(`[replay] first drain: step ${result.firstDrainFrame.step} (slot ${result.firstDrainFrame.slot}, ${result.firstDrainFrame.time})`);
  console.log(
    `[replay] MEASURED lead time (first transition alert -> first drain): ${result.leadTimeSeconds} s (${result.leadTimeSeconds ? (result.leadTimeSeconds / 86400).toFixed(2) : 'n/a'} days) — measured, not asserted`
  );

  const runId = await storeReplayRun(db, result);
  console.log(`[replay] stored as replay_runs.id = ${runId}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[replay] fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
