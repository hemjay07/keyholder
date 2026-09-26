// File: apps/worker/src/ingest/filter.ts
//
// Coarse ingest-time filter per plan/BACKEND.md §2 and PLAN.md Task 2.3:
// keep BPF Upgradeable Loader instructions with discriminant tag 2-7 only
// (drop tag 0 InitializeBuffer and tag 1 Write, which is >98% of loader
// traffic per research/11-sketch-upgrade-watch.md A3); keep Squads v4
// config/proposal/vault-execute instructions; keep SPL Governance
// instructions for tracked protocols; keep System Program nonce
// instructions (indices 4-7) only when a watched signer/account is
// involved; keep any instruction whose program is in the tracked-protocol
// admin set. This is a pre-filter only — full privilege classification
// (packages/decoder's classifyPrivilege) happens in the decode phase
// downstream, against IDLs this task does not load.
//
// Dropping >98% of loader `Write` traffic here (rather than downstream) is
// the difference between a pipeline that can run on a free-tier RPC and one
// that cannot.

import { createHash } from 'node:crypto';
import {
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  SQUADS_V4_PROGRAM_ID,
} from '@keyholder/decoder';
import type { IngestCandidate, RawInstruction } from './types';

export const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111111111';
export const SPL_GOVERNANCE_PROGRAM_ID = 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw';

/** Loader tags to keep. Tag 1 (Write) and tag 0 (InitializeBuffer) are dropped. */
const KEPT_LOADER_TAGS = new Set([2, 3, 4, 5, 6, 7]);

/** System Program instruction indices that touch nonce accounts. */
const NONCE_INSTRUCTION_INDICES = new Set([4, 5, 6, 7]);

/** Anchor global instruction discriminator: first 8 bytes of sha256(`global:<name>`). */
function anchorDiscriminator(ixName: string): Buffer {
  return createHash('sha256').update(`global:${ixName}`).digest().subarray(0, 8);
}

const SQUADS_KEPT_INSTRUCTIONS = [
  'configTransactionCreate',
  'configTransactionExecute',
  'proposalCreate',
  'proposalActivate',
  'proposalApprove',
  'proposalReject',
  'proposalCancel',
  'vaultTransactionCreate',
  'vaultTransactionExecute',
  'multisigCreate',
  'multisigAddMember',
  'multisigRemoveMember',
  'multisigChangeThreshold',
  'multisigSetTimeLock',
] as const;

const SQUADS_KEPT_DISCRIMINATORS = new Set(
  SQUADS_KEPT_INSTRUCTIONS.map((name) => anchorDiscriminator(name).toString('hex'))
);

export interface FilterConfig {
  /** Program IDs whose instructions are always kept (tracked protocol admin ix). */
  trackedProgramIds: ReadonlySet<string>;
  /** Signer/account addresses that make a System nonce ix interesting. */
  watchedSigners: ReadonlySet<string>;
  /** SPL Governance program IDs to keep in full (usually just the one mainnet deployment). */
  governanceProgramIds?: ReadonlySet<string>;
}

export interface FilterVerdict {
  keep: boolean;
  reason: string;
}

function loaderTag(data: Buffer): number | null {
  if (data.length < 4) return null;
  return data.readUInt32LE(0);
}

function isNonceInstruction(data: Buffer): number | null {
  if (data.length < 4) return null;
  const index = data.readUInt32LE(0);
  return NONCE_INSTRUCTION_INDICES.has(index) ? index : null;
}

/** Filters a single instruction. Exported for unit tests and for reuse by callers doing their own flattening. */
export function filterInstruction(ix: RawInstruction, config: FilterConfig): FilterVerdict {
  if (ix.programId === BPF_LOADER_UPGRADEABLE_PROGRAM_ID) {
    const tag = loaderTag(ix.data);
    if (tag !== null && KEPT_LOADER_TAGS.has(tag)) {
      return { keep: true, reason: `loader tag ${tag}` };
    }
    return { keep: false, reason: tag === 1 ? 'loader Write dropped' : 'loader tag not in 2-7' };
  }

  if (ix.programId === SQUADS_V4_PROGRAM_ID) {
    const discHex = ix.data.subarray(0, 8).toString('hex');
    if (SQUADS_KEPT_DISCRIMINATORS.has(discHex)) {
      return { keep: true, reason: 'squads config/proposal/vault ix' };
    }
    // Unknown Squads ix (e.g. a variant not in our kept list): keep anyway,
    // since Squads volume is low and an unrecognized admin ix is exactly
    // the kind of thing we don't want to silently drop.
    return { keep: true, reason: 'squads ix (unclassified, kept conservatively)' };
  }

  const govIds = config.governanceProgramIds ?? new Set([SPL_GOVERNANCE_PROGRAM_ID]);
  if (govIds.has(ix.programId)) {
    return { keep: true, reason: 'spl governance ix' };
  }

  if (ix.programId === SYSTEM_PROGRAM_ID) {
    const nonceIndex = isNonceInstruction(ix.data);
    if (nonceIndex === null) {
      return { keep: false, reason: 'system ix not nonce-related' };
    }
    const involvesWatchedSigner = ix.accounts.some((a) => config.watchedSigners.has(a.pubkey));
    if (involvesWatchedSigner) {
      return { keep: true, reason: `nonce ix ${nonceIndex} on watched signer` };
    }
    return { keep: false, reason: 'nonce ix on unwatched signer' };
  }

  if (config.trackedProgramIds.has(ix.programId)) {
    return { keep: true, reason: 'tracked protocol admin ix' };
  }

  return { keep: false, reason: 'not a watched program' };
}

/** True if any instruction in the candidate transaction should be kept. */
export function shouldKeepCandidate(candidate: IngestCandidate, config: FilterConfig): boolean {
  return candidate.instructions.some((ix) => filterInstruction(ix, config).keep);
}
