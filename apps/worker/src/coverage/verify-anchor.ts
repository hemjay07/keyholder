// File: apps/worker/src/coverage/verify-anchor.ts
// Recompute a day's hash from program_daily and compare it with the memo on chain.
// Exit 0 only when the rows, the stored hash and the on-chain memo all agree.
// Run: npx tsx src/coverage/verify-anchor.ts <YYYY-MM-DD>

import { join } from 'node:path';
import { Connection } from '@solana/web3.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { program_daily, daily_anchor } from '../schema';
import { digest, parseMemo, MEMO_PROGRAM_ID, type DailyRow } from './anchor';

dotenv.config({ path: join(__dirname, '..', '..', '..', '..', '.env') });

async function main(): Promise<void> {
  const day = process.argv[2] ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('usage: verify-anchor.ts YYYY-MM-DD');
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
  const db: ReturnType<typeof drizzle> = drizzle(sql);
  try {
    const [a] = await db.select().from(daily_anchor).where(eq(daily_anchor.day, day));
    if (!a) throw new Error(`no anchor for ${day}`);
    const rows = (await db.select().from(program_daily).where(eq(program_daily.day, day))) as unknown as DailyRow[];
    const recomputed = digest(rows);
    const tx = await new Connection(a.cluster, 'confirmed').getTransaction(a.signature, { maxSupportedTransactionVersion: 0 });
    const msg = tx?.transaction.message;
    const keys = msg ? msg.getAccountKeys().staticAccountKeys : [];
    const memo = (msg?.compiledInstructions ?? [])
      .filter((ix) => keys[ix.programIdIndex]?.equals(MEMO_PROGRAM_ID))
      .map((ix) => parseMemo(Buffer.from(ix.data).toString('utf8'))).find(Boolean) ?? null;
    const ok = !!memo && memo.day === day && memo.hash === recomputed && memo.hash === a.sha256 && memo.count === rows.length;
    console.log(JSON.stringify({ day, rows: rows.length, recomputed, stored: a.sha256, memo, signature: a.signature, slot: tx?.slot, blockTime: tx?.blockTime, ok }));
    if (!ok) process.exitCode = 1;
  } finally { await sql.end(); }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
