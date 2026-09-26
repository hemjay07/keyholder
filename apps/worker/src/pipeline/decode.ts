// File: apps/worker/src/pipeline/decode.ts
//
// Decode stage: raw_tx rows not yet decoded -> @keyholder/decoder -> `events`
// rows, idempotent on event_uid ('signature:ix_path'). Marks each processed
// raw_tx row 'decoded' or 'failed' (raw_tx.status, already in schema.ts —
// no new column needed, arch/B-worker.md's suggestion in this task's brief
// is satisfied by the existing 'pending'|'decoded'|'failed' enum).
//
// Per-instruction decoding routes by program id:
//   - BPF Upgradeable Loader (tags 2-7; ingest's filter.ts already dropped
//     0/1): packages/decoder's decodeBpfLoaderInstruction, pure bytes, no IDL.
//   - Squads v4 / Squads v3: generic Anchor decode via a discovered IDL
//     (idl-cache.ts -> @keyholder/decoder's discoverIdl, legacy Anchor IDL
//     account — verified live for Squads v4 in idl-loader.ts's header).
//   - Any other program with a discoverable Anchor IDL (Drift, Kamino, ...):
//     same generic path, then privilege-classified against this protocol's
//     currently-known controllers (protocol-index.ts).
//   - SPL Governance: no decoder exists in this repo (native Borsh, not
//     Anchor — DEV-070, honestly undecoded rather than guessed).
//   - System Program nonce instructions (ingest only keeps these when a
//     watched signer is involved): packages/decoder's decodeSystemInstruction.
//   - Anything else: stored as 'account_changed_undecoded' with the raw hex,
//     never silently dropped (REAL ONLY: an event this stage can't interpret
//     is still recorded, just uncategorized).

import type { Connection } from '@solana/web3.js';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db';
import { raw_tx, events } from '../schema';
import { parseAndFlattenRawTx, type FlatInstruction, RawTxParseError } from './parse-raw-tx';
import type { IdlCache } from './idl-cache';
import type { ProtocolIndex } from './protocol-index';
import {
  decodeBpfLoaderInstruction,
  LoaderDecodeError,
  upgradeAccounts,
  decodeAnchorInstruction,
  camelToSnake,
  classifyPrivilege,
  decodeSystemInstruction,
  SystemDecodeError,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  SQUADS_V4_PROGRAM_ID,
  SQUADS_V3_PROGRAM_ID,
} from '@keyholder/decoder';
import { SPL_GOVERNANCE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../ingest/filter';

export interface DecodeLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
}

const consoleLogger: DecodeLogger = {
  info: (msg, meta) => console.log(`[decode] ${msg}`, meta ?? ''),
  warn: (msg, meta) => console.warn(`[decode] ${msg}`, meta ?? ''),
  error: (msg, meta) => console.error(`[decode] ${msg}`, meta ?? ''),
};

export interface EventInsert {
  event_uid: string;
  slot: number;
  block_time: Date;
  signature: string;
  ix_path: string;
  protocol_id: string | null;
  program_id: string | null;
  kind: string;
  category: string | null;
  actor: string[];
  payload: unknown;
  privilege_basis: 'idl_relation' | 'name' | 'runtime_match' | null;
  decode_confidence: 'high' | 'low' | null;
  finalized: boolean;
}

/** JSON-safe recursive sanitizer: BigInt -> string, Buffer -> hex string. Payload is stored as jsonb. */
function sanitizeForJson(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (Array.isArray(value)) return value.map(sanitizeForJson);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitizeForJson(v);
    return out;
  }
  return value;
}

const ADMIN_FIELD_PATTERN = /^(new_?admin|admin|new_?authority|authority)$/i;

function looksLikeBase58Address(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 32 && v.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(v);
}

/** Finds a field in decoded Anchor args that looks like a newly-assigned admin/authority pubkey. */
function findAdminField(args: Record<string, unknown>): { field: string; value: string } | null {
  for (const [key, value] of Object.entries(args)) {
    if (ADMIN_FIELD_PATTERN.test(key) && looksLikeBase58Address(value)) {
      return { field: 'admin', value };
    }
  }
  return null;
}

async function decodeOneInstruction(
  ix: FlatInstruction,
  ctx: {
    signature: string;
    slot: number;
    blockTime: Date;
    finalized: boolean;
    idlCache: IdlCache;
    protocolIndex: ProtocolIndex;
  }
): Promise<EventInsert | null> {
  const actor = ix.accounts.filter((a) => a.isSigner).map((a) => a.pubkey);
  const base = {
    event_uid: `${ctx.signature}:${ix.ixPath}`,
    slot: ctx.slot,
    block_time: ctx.blockTime,
    signature: ctx.signature,
    ix_path: ix.ixPath,
    actor,
    finalized: ctx.finalized,
  };

  // ── BPF Upgradeable Loader ────────────────────────────────────────────────
  if (ix.programId === BPF_LOADER_UPGRADEABLE_PROGRAM_ID) {
    try {
      const decoded = decodeBpfLoaderInstruction(ix.data);
      if (decoded.type === 'Upgrade') {
        const accs = upgradeAccounts(ix.accounts.map((a) => a.pubkey));
        const resolved = ctx.protocolIndex.programDataToProgram.get(accs.programData);
        return {
          ...base,
          protocol_id: resolved?.protocolId ?? null,
          program_id: accs.program,
          kind: 'upgrade',
          category: 'upgrade',
          payload: sanitizeForJson({ programData: accs.programData, program: accs.program, upgradeAuthority: accs.upgradeAuthority }),
          privilege_basis: 'runtime_match',
          decode_confidence: 'high',
        };
      }
      if (decoded.type === 'SetAuthority' || decoded.type === 'SetAuthorityChecked') {
        const programData = ix.accounts[0]?.pubkey ?? null;
        const currentAuthority = ix.accounts[1]?.pubkey ?? null;
        const newAuthority = ix.accounts[2]?.pubkey ?? null;
        const resolved = programData ? ctx.protocolIndex.programDataToProgram.get(programData) : undefined;
        return {
          ...base,
          protocol_id: resolved?.protocolId ?? null,
          program_id: resolved?.programId ?? null,
          kind: 'set_authority',
          category: 'authority',
          payload: sanitizeForJson({ programData, currentAuthority, newAuthority }),
          privilege_basis: 'runtime_match',
          decode_confidence: 'high',
        };
      }
      const programData = ix.accounts[0]?.pubkey ?? null;
      const resolved = programData ? ctx.protocolIndex.programDataToProgram.get(programData) : undefined;
      return {
        ...base,
        protocol_id: resolved?.protocolId ?? null,
        program_id: resolved?.programId ?? null,
        kind: camelToSnake(decoded.type.charAt(0).toLowerCase() + decoded.type.slice(1)),
        category: 'loader',
        payload: sanitizeForJson(decoded),
        privilege_basis: null,
        decode_confidence: 'high',
      };
    } catch (err) {
      return {
        ...base,
        protocol_id: null,
        program_id: null,
        kind: 'account_changed_undecoded',
        category: 'loader',
        payload: { error: err instanceof LoaderDecodeError ? err.message : String(err), dataHex: ix.data.toString('hex') },
        privilege_basis: null,
        decode_confidence: 'low',
      };
    }
  }

  // ── System Program (nonce instructions only reach here; ingest filters the rest) ──
  if (ix.programId === SYSTEM_PROGRAM_ID) {
    try {
      const decoded = decodeSystemInstruction(ix.data);
      if (decoded.type === 'InitializeNonceAccount') {
        const nonceAddress = ix.accounts[0]?.pubkey ?? null;
        // fold.ts derives `authorityIsController` itself (against the
        // protocol's current admin/multisig at fold time); this stage only
        // needs to report whether the authority is *already* a known
        // controller as of decode time, which is a useful hint but not
        // authoritative — fold.ts re-checks it against the state at the
        // event's own slot.
        const authorityIsController = ctx.protocolIndex.controllerToProtocol.has(decoded.authorized);
        return {
          ...base,
          protocol_id: ctx.protocolIndex.controllerToProtocol.get(decoded.authorized) ?? null,
          program_id: null,
          kind: 'nonce_created',
          category: 'nonce',
          payload: sanitizeForJson({ nonceAddress, authority: decoded.authorized, authorityIsController }),
          privilege_basis: null,
          decode_confidence: 'high',
        };
      }
      if (decoded.type === 'AdvanceNonceAccount') {
        return { ...base, protocol_id: null, program_id: null, kind: 'nonce_advanced', category: 'nonce', payload: {}, privilege_basis: null, decode_confidence: 'high' };
      }
      if (decoded.type === 'AuthorizeNonceAccount') {
        return {
          ...base,
          protocol_id: null,
          program_id: null,
          kind: 'nonce_authority_changed',
          category: 'nonce',
          payload: sanitizeForJson({ newAuthorized: decoded.newAuthorized }),
          privilege_basis: null,
          decode_confidence: 'high',
        };
      }
      return null; // Transfer/CreateAccount/etc: not control-relevant, and ingest's filter should not have kept these anyway.
    } catch (err) {
      return {
        ...base,
        protocol_id: null,
        program_id: null,
        kind: 'account_changed_undecoded',
        category: 'nonce',
        payload: { error: err instanceof SystemDecodeError ? err.message : String(err), dataHex: ix.data.toString('hex') },
        privilege_basis: null,
        decode_confidence: 'low',
      };
    }
  }

  // ── SPL Governance: no decoder in this repo (native Borsh) — DEV-070 ──────
  if (ix.programId === SPL_GOVERNANCE_PROGRAM_ID) {
    return {
      ...base,
      protocol_id: null,
      program_id: ix.programId,
      kind: 'account_changed_undecoded',
      category: 'governance',
      payload: { note: 'spl_governance instruction decoder not implemented (native Borsh, no Anchor IDL) — DEV-070', dataHex: ix.data.toString('hex') },
      privilege_basis: null,
      decode_confidence: 'low',
    };
  }

  // ── Squads v4 / v3 / any other program with a discoverable Anchor IDL ─────
  const idlProgramId = ix.programId === SQUADS_V3_PROGRAM_ID ? SQUADS_V3_PROGRAM_ID : ix.programId;
  const discovered = await ctx.idlCache.get(idlProgramId);
  if (!discovered) {
    return {
      ...base,
      protocol_id: ctx.protocolIndex.programIdToProtocol.get(ix.programId) ?? null,
      program_id: ix.programId,
      kind: 'account_changed_undecoded',
      category: null,
      payload: { note: 'no Anchor IDL discoverable for this program', dataHex: ix.data.toString('hex') },
      privilege_basis: null,
      decode_confidence: 'low',
    };
  }

  const result = decodeAnchorInstruction(ix.programId, discovered.idl, ix.data);
  const protocolId = ctx.protocolIndex.programIdToProtocol.get(ix.programId) ?? null;

  if (result.kind === 'undecoded') {
    return {
      ...base,
      protocol_id: protocolId,
      program_id: ix.programId,
      kind: 'account_changed_undecoded',
      category: null,
      payload: { reason: result.reason, dataHex: result.dataHex },
      privilege_basis: null,
      decode_confidence: 'low',
    };
  }

  const isSquads = ix.programId === SQUADS_V4_PROGRAM_ID || ix.programId === SQUADS_V3_PROGRAM_ID;
  const kind = isSquads ? camelToSnake(result.ix.name) : 'privileged_ix';

  if (isSquads) {
    // Squads config actions are proposed at *_create time and only take
    // effect at *_execute; this stage does not read the ConfigTransaction
    // account to re-derive the exact applied multisig snapshot (that would
    // need an Anchor *account* decoder, which this package does not have —
    // DEV-071, DEGRADED). The state stage instead re-derives multisig/
    // authority facts from a live chain read (authority.ts's
    // resolveAuthority) on every affected protocol, so these events serve
    // as an audit trail and a risk-stage trigger, not as the multisig
    // payload fold.ts folds directly.
    const controllerProtocol = ctx.protocolIndex.controllerToProtocol.get(ix.programId) ?? null;
    // Try to resolve via the 'multisig' account in this instruction's own account list.
    let resolvedProtocol = controllerProtocol;
    for (const acc of ix.accounts) {
      const p = ctx.protocolIndex.controllerToProtocol.get(acc.pubkey);
      if (p) {
        resolvedProtocol = p;
        break;
      }
    }
    return {
      ...base,
      protocol_id: resolvedProtocol,
      program_id: ix.programId,
      kind,
      category: 'squads',
      payload: sanitizeForJson(result.ix.args),
      privilege_basis: null,
      decode_confidence: 'high',
    };
  }

  const knownControllers = new Set<string>(ctx.protocolIndex.controllerToProtocol.keys());
  const verdict = classifyPrivilege(discovered.idl, result.ix.name, ix.accounts.map((a) => ({ pubkey: a.pubkey, isSigner: a.isSigner })), knownControllers);

  if (!verdict.privileged) {
    return {
      ...base,
      protocol_id: protocolId,
      program_id: ix.programId,
      kind: 'account_changed_undecoded',
      category: null,
      payload: sanitizeForJson({ ixName: result.ix.name, args: result.ix.args, note: 'decoded but not privilege-classified' }),
      privilege_basis: null,
      decode_confidence: 'high',
    };
  }

  const adminField = findAdminField(result.ix.args);
  return {
    ...base,
    protocol_id: protocolId,
    program_id: ix.programId,
    kind: 'privileged_ix',
    category: 'privileged',
    payload: sanitizeForJson({
      ixName: result.ix.name,
      args: result.ix.args,
      matchedAccount: verdict.matchedAccount,
      ...(adminField ? { field: adminField.field, newValue: adminField.value } : {}),
    }),
    privilege_basis: verdict.basis,
    decode_confidence: 'high',
  };
}

export interface DecodeStageResult {
  rawTxProcessed: number;
  eventsInserted: number;
  failed: number;
  /** Distinct protocol ids that got at least one new event this batch — the runner uses this to know which protocols to re-run state/risk for. */
  protocolIdsTouched: string[];
}

export interface DecodeStageOptions {
  db: Db;
  connection: Connection;
  idlCache: IdlCache;
  protocolIndex: ProtocolIndex;
  logger?: DecodeLogger;
  batchSize?: number;
}

/**
 * Processes one batch of pending raw_tx rows into events. Idempotent
 * (event_uid onConflictDoNothing) and safe to call repeatedly on a poll loop
 * — see runner.ts.
 */
export async function runDecodeStage(opts: DecodeStageOptions): Promise<DecodeStageResult> {
  const logger = opts.logger ?? consoleLogger;
  const batchSize = opts.batchSize ?? 200;

  const rows = await opts.db
    .select({ signature: raw_tx.signature, tx: raw_tx.tx, commitment: raw_tx.commitment })
    .from(raw_tx)
    .where(eq(raw_tx.status, 'pending'))
    .limit(batchSize);

  let eventsInserted = 0;
  let failed = 0;
  const decodedSignatures: string[] = [];
  const failedSignatures: string[] = [];
  const protocolIdsTouched = new Set<string>();

  for (const row of rows) {
    if (!row.tx) {
      failedSignatures.push(row.signature);
      failed++;
      continue;
    }
    try {
      const parsed = parseAndFlattenRawTx(Buffer.from(row.tx));
      const blockTime = parsed.blockTime ?? new Date();
      const toInsert: EventInsert[] = [];
      for (const ix of parsed.instructions) {
        const decoded = await decodeOneInstruction(ix, {
          signature: row.signature,
          slot: parsed.slot,
          blockTime,
          finalized: row.commitment === 'finalized',
          idlCache: opts.idlCache,
          protocolIndex: opts.protocolIndex,
        });
        if (decoded) toInsert.push(decoded);
      }
      if (toInsert.length > 0) {
        const inserted = await opts.db
          .insert(events)
          .values(toInsert)
          .onConflictDoNothing({ target: events.event_uid })
          .returning({ id: events.id, protocol_id: events.protocol_id });
        eventsInserted += inserted.length;
        for (const row of inserted) {
          if (row.protocol_id) protocolIdsTouched.add(row.protocol_id);
        }
      }
      decodedSignatures.push(row.signature);
    } catch (err) {
      failed++;
      failedSignatures.push(row.signature);
      logger.error('failed to decode raw_tx row', {
        signature: row.signature,
        error: err instanceof RawTxParseError ? err.message : String(err),
        cause: err instanceof Error && err.cause ? String(err.cause) : undefined,
      });
    }
  }

  if (decodedSignatures.length > 0) {
    await opts.db.update(raw_tx).set({ status: 'decoded' }).where(and(eq(raw_tx.status, 'pending'), inArray(raw_tx.signature, decodedSignatures)));
  }
  if (failedSignatures.length > 0) {
    await opts.db.update(raw_tx).set({ status: 'failed' }).where(and(eq(raw_tx.status, 'pending'), inArray(raw_tx.signature, failedSignatures)));
  }

  return { rawTxProcessed: rows.length, eventsInserted, failed, protocolIdsTouched: [...protocolIdsTouched] };
}
