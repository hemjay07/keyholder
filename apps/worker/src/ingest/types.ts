// File: apps/worker/src/ingest/types.ts
//
// Shared types for the ingest service (Task 2.3). Two sources feed the same
// pipeline: `yellowstone.ts` (Triton gRPC, disabled until YELLOWSTONE_TOKEN
// exists) and `poller.ts` (WebSocket logsSubscribe/accountSubscribe + a
// getSignaturesForAddress reconciliation poll, which works today on the
// Helius free tier). Both normalize into `IngestCandidate` before the
// shared filter -> dedup -> finality -> raw_tx pipeline in `index.ts`.

export type IngestSourceName = 'yellowstone' | 'ws' | 'poller';

export type CommitmentTier = 'processed' | 'confirmed' | 'finalized';

/** One raw instruction as seen by the filter, program-agnostic. */
export interface RawInstruction {
  programId: string;
  /** Raw instruction data, decoded from base58/base64 by the source. */
  data: Buffer;
  /** Account pubkeys in instruction order, with signer flags where known. */
  accounts: Array<{ pubkey: string; isSigner: boolean }>;
}

/** A candidate transaction, normalized from any source, before filtering. */
export interface IngestCandidate {
  signature: string;
  slot: number;
  blockTime: Date | null;
  commitment: CommitmentTier;
  source: IngestSourceName;
  /** Top-level + inner instructions, flattened; used by filter.ts only. */
  instructions: RawInstruction[];
  /** The raw transaction payload as returned by the source, stored verbatim. */
  raw: unknown;
}

/** Registry entry: an account this ingest pipeline watches. */
export interface WatchedAccount {
  address: string;
  kind: 'program' | 'program_data' | 'multisig' | 'vault' | 'admin' | 'signer';
  protocolId: string | null;
  label: string | null;
}

export interface WatchedProgram {
  programId: string;
  label: string;
}
