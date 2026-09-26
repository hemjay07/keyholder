// File: apps/worker/src/pipeline/protocol-index.ts
//
// Cheap, DB-only lookups the decode stage needs to attribute a raw
// instruction to a tracked protocol, without any extra RPC calls per
// instruction:
//   - programData address -> {programId, protocolId} (from `programs`,
//     written once by seed.ts/registry.ts) — resolves a BPF Loader
//     SetAuthority/Upgrade instruction's `program` account back to a
//     protocol.
//   - a controller address (upgrade authority, Squads multisig, or admin)
//     -> protocolId (from each protocol's most recent `control_state` row)
//     — resolves a Squads instruction's `multisig` account, or a generic
//     Anchor instruction's signer, back to a protocol.
//
// Both are best-effort and eventually consistent: a controller that has
// never been seen in a written control_state row (e.g. a brand-new,
// never-before-tracked multisig) will not resolve to a protocol yet — that
// instruction is still decoded and stored as an event, just with
// protocol_id left null, which the risk stage correctly skips (no prior
// state to compare against). Logged as DEV-070 (see this task's report).

import { sql } from 'drizzle-orm';
import type { Db } from '../db';
import { programs, control_state } from '../schema';
import type { ControlState } from '@keyholder/risk';

export interface ProtocolIndex {
  programDataToProgram: Map<string, { programId: string; protocolId: string | null }>;
  programIdToProtocol: Map<string, string | null>;
  controllerToProtocol: Map<string, string>;
}

export async function buildProtocolIndex(db: Db): Promise<ProtocolIndex> {
  const programDataToProgram = new Map<string, { programId: string; protocolId: string | null }>();
  const programIdToProtocol = new Map<string, string | null>();

  const programRows = await db
    .select({ program_id: programs.program_id, protocol_id: programs.protocol_id, programdata_addr: programs.programdata_addr })
    .from(programs);
  for (const row of programRows) {
    programIdToProtocol.set(row.program_id, row.protocol_id);
    if (row.programdata_addr) {
      programDataToProgram.set(row.programdata_addr, { programId: row.program_id, protocolId: row.protocol_id });
    }
  }

  const controllerToProtocol = new Map<string, string>();
  // Latest control_state row per protocol_id.
  const latestRows = await db.execute<{ protocol_id: string; state: unknown }>(sql`
    SELECT DISTINCT ON (protocol_id) protocol_id, state
    FROM control_state
    ORDER BY protocol_id, slot DESC
  `);
  for (const row of latestRows) {
    const state = row.state as ControlState | null;
    if (!state) continue;
    if (state.authorityAddress) controllerToProtocol.set(state.authorityAddress, row.protocol_id);
    if (state.multisig?.address) controllerToProtocol.set(state.multisig.address, row.protocol_id);
    if (state.admin) controllerToProtocol.set(state.admin, row.protocol_id);
  }

  return { programDataToProgram, programIdToProtocol, controllerToProtocol };
}
