// @keyholder/sdk — thin TypeScript client for the keyholder on-chain
// control-policy program. Built on @anchor-lang/core 1.2.0 (npm, published
// 2026-09-04) for BN/web3 re-exports; instructions are built manually
// (Anchor's raw ABI: 8-byte `global:<name>` sighash + borsh args) rather
// than through a generated IDL client, so this also documents the
// non-Anchor / native integration path from ONCHAIN.md §4.

import { BN, web3 } from "@anchor-lang/core";
import { createHash } from "node:crypto";

const { PublicKey, SystemProgram } = web3;
export type PublicKeyLike = InstanceType<typeof PublicKey>;

export const KEYHOLDER_PROGRAM_ID = new PublicKey(
  "3FX57MQmZH8dkpFV5nbA1XWyV6WDeinu7ennZhvx8R8F"
);

export const BPF_LOADER_UPGRADEABLE_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

export const SQUADS_V4_PROGRAM_ID = new PublicKey(
  "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
);

// ---------------------------------------------------------------- PDAs

export function configPda(programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
}

export function attesterRegistryPda(programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync([Buffer.from("attesters")], programId);
}

export function controlStatePda(target: PublicKeyLike, programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("control"), target.toBuffer()],
    programId
  );
}

export function policyPda(owner: PublicKeyLike, policyId: bigint, programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID) {
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(policyId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), owner.toBuffer(), idBuf],
    programId
  );
}

export function programDataAddress(target: PublicKeyLike) {
  return PublicKey.findProgramAddressSync([target.toBuffer()], BPF_LOADER_UPGRADEABLE_ID);
}

export function squadsVaultPda(multisig: PublicKeyLike, vaultIndex: number) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("multisig"), multisig.toBuffer(), Buffer.from("vault"), Buffer.from([vaultIndex])],
    SQUADS_V4_PROGRAM_ID
  );
}

// ---------------------------------------------------------------- raw ABI

/** sha256("global:<name>")[..8] — Anchor's instruction sighash. */
export function ixSighash(name: string): Buffer {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

export interface PolicyParams {
  minThreshold: number; // u16
  minTimeLock: number; // u32
  allowSingleKey: boolean;
  cooldownAfterWeakenSlots: bigint; // u64
  cooldownAfterDeploySlots: bigint; // u64
  maxRefreshAgeSlots: bigint; // u64
  requireAttestedOk: boolean;
  maxRiskLevel: number; // u8
  requireVerifiedBuild: boolean;
  mode: 0 | 1; // 0 = Enforce, 1 = Report
  policyUpdateTimelockSlots: bigint; // u64
}

export function encodePolicyParams(p: PolicyParams): Buffer {
  const buf = Buffer.alloc(2 + 4 + 1 + 8 + 8 + 8 + 1 + 1 + 1 + 1 + 8);
  let o = 0;
  buf.writeUInt16LE(p.minThreshold, o); o += 2;
  buf.writeUInt32LE(p.minTimeLock, o); o += 4;
  buf.writeUInt8(p.allowSingleKey ? 1 : 0, o); o += 1;
  buf.writeBigUInt64LE(p.cooldownAfterWeakenSlots, o); o += 8;
  buf.writeBigUInt64LE(p.cooldownAfterDeploySlots, o); o += 8;
  buf.writeBigUInt64LE(p.maxRefreshAgeSlots, o); o += 8;
  buf.writeUInt8(p.requireAttestedOk ? 1 : 0, o); o += 1;
  buf.writeUInt8(p.maxRiskLevel, o); o += 1;
  buf.writeUInt8(p.requireVerifiedBuild ? 1 : 0, o); o += 1;
  buf.writeUInt8(p.mode, o); o += 1;
  buf.writeBigUInt64LE(p.policyUpdateTimelockSlots, o); o += 8;
  return buf;
}

export function createPolicyIx(
  owner: PublicKeyLike,
  policyId: bigint,
  params: PolicyParams,
  programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID
) {
  const [policy] = policyPda(owner, policyId, programId);
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64LE(policyId);
  const data = Buffer.concat([ixSighash("create_policy"), idBuf, encodePolicyParams(params)]);
  return new web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function registerTargetIx(
  payer: PublicKeyLike,
  target: PublicKeyLike,
  multisig: PublicKeyLike | null,
  programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID
) {
  const [control] = controlStatePda(target, programId);
  const [pd] = programDataAddress(target);
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: control, isSigner: false, isWritable: true },
    { pubkey: target, isSigner: false, isWritable: false },
    { pubkey: pd, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  if (multisig) keys.push({ pubkey: multisig, isSigner: false, isWritable: false });
  return new web3.TransactionInstruction({ programId, keys, data: ixSighash("register_target") });
}

export function refreshIx(
  target: PublicKeyLike,
  multisig: PublicKeyLike | null,
  programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID
) {
  const [control] = controlStatePda(target, programId);
  const [pd] = programDataAddress(target);
  const keys = [
    { pubkey: control, isSigner: false, isWritable: true },
    { pubkey: target, isSigner: false, isWritable: false },
    { pubkey: pd, isSigner: false, isWritable: false },
  ];
  if (multisig) keys.push({ pubkey: multisig, isSigner: false, isWritable: false });
  return new web3.TransactionInstruction({ programId, keys, data: ixSighash("refresh") });
}

/** Builds a `check` instruction. `multisig` is required iff the target's
 * live authority resolves to a Squads v4 vault (per its ControlState). */
export function checkIx(
  policy: PublicKeyLike,
  target: PublicKeyLike,
  multisig: PublicKeyLike | null,
  programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID
) {
  const [config] = configPda(programId);
  const [control] = controlStatePda(target, programId);
  const [pd] = programDataAddress(target);
  return new web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: policy, isSigner: false, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: control, isSigner: false, isWritable: false },
      { pubkey: target, isSigner: false, isWritable: false },
      { pubkey: pd, isSigner: false, isWritable: false },
      // Anchor's None-optional-account convention: pass the program id itself.
      { pubkey: multisig ?? programId, isSigner: false, isWritable: false },
    ],
    data: ixSighash("check"),
  });
}

// ---------------------------------------------------------------- results

export const REASON_FLAGS = {
  SINGLE_KEY: 1 << 0,
  THRESHOLD_BELOW_POLICY: 1 << 1,
  TIMELOCK_BELOW_POLICY: 1 << 2,
  RECENTLY_WEAKENED: 1 << 3,
  RECENTLY_UPGRADED: 1 << 4,
  CONTROLLED_MULTISIG: 1 << 5,
  UNKNOWN_AUTHORITY: 1 << 6,
  ATTESTATION_STALE: 1 << 7,
  RISK_TOO_HIGH: 1 << 8,
  NOT_VERIFIED: 1 << 9,
  REFRESH_TOO_OLD: 1 << 10,
} as const;

export const REASON_MESSAGES: Record<number, string> = {
  [REASON_FLAGS.SINGLE_KEY]: "single-key authority",
  [REASON_FLAGS.THRESHOLD_BELOW_POLICY]: "threshold below policy minimum",
  [REASON_FLAGS.TIMELOCK_BELOW_POLICY]: "timelock below policy minimum",
  [REASON_FLAGS.RECENTLY_WEAKENED]: "control was weakened too recently",
  [REASON_FLAGS.RECENTLY_UPGRADED]: "program was upgraded too recently",
  [REASON_FLAGS.CONTROLLED_MULTISIG]: "multisig has a controlling config_authority",
  [REASON_FLAGS.UNKNOWN_AUTHORITY]: "authority type could not be determined",
  [REASON_FLAGS.ATTESTATION_STALE]: "attestation is stale",
  [REASON_FLAGS.RISK_TOO_HIGH]: "attested risk level too high",
  [REASON_FLAGS.NOT_VERIFIED]: "build is not verified",
  [REASON_FLAGS.REFRESH_TOO_OLD]: "ControlState has not been refreshed recently enough",
};

export interface CheckResult {
  ok: boolean;
  reasons: number;
  derivedScore: number;
  threshold: number;
  timeLock: number;
  lastWeakenedSlot: bigint;
  reasonMessages: string[];
}

/** Decodes the borsh-encoded `CheckResult` struct keyholder's `check`
 * instruction writes via `set_return_data`. Fixed layout — see
 * `programs/keyholder/src/lib.rs::CheckResult`. */
export function decodeCheckResult(data: Buffer): CheckResult {
  let o = 0;
  const ok = data.readUInt8(o) !== 0; o += 1;
  const reasons = data.readUInt32LE(o); o += 4;
  const derivedScore = data.readUInt8(o); o += 1;
  const threshold = data.readUInt16LE(o); o += 2;
  const timeLock = data.readUInt32LE(o); o += 4;
  const lastWeakenedSlot = data.readBigUInt64LE(o); o += 8;
  const reasonMessages = Object.entries(REASON_FLAGS)
    .filter(([, bit]) => (reasons & bit) !== 0)
    .map(([name]) => REASON_MESSAGES[REASON_FLAGS[name as keyof typeof REASON_FLAGS]] ?? name);
  return { ok, reasons, derivedScore, threshold, timeLock, lastWeakenedSlot, reasonMessages };
}

/**
 * Simulate-before-sign helper (ONCHAIN.md §4): given a target program with a
 * registered ControlState and a wallet/router policy, builds and simulates a
 * Report-mode `check` instruction and returns the decoded, human-readable
 * result — without requiring the caller to hold any account of their own
 * beyond a public "wallet default" policy.
 */
export async function simulateCheck(
  connection: InstanceType<typeof web3.Connection>,
  payer: PublicKeyLike,
  policy: PublicKeyLike,
  target: PublicKeyLike,
  multisig: PublicKeyLike | null,
  programId: PublicKeyLike = KEYHOLDER_PROGRAM_ID
): Promise<CheckResult> {
  const ix = checkIx(policy, target, multisig, programId);
  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new web3.TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new web3.VersionedTransaction(msg);
  const sim = await connection.simulateTransaction(tx, { sigVerify: false, replaceRecentBlockhash: true });
  if (sim.value.err) {
    // Enforce mode (or an account error): no return data, but the specific
    // GuardError is visible in the logs.
    return {
      ok: false,
      reasons: 0,
      derivedScore: 0,
      threshold: 0,
      timeLock: 0,
      lastWeakenedSlot: 0n,
      reasonMessages: [`enforced-reject: ${JSON.stringify(sim.value.err)}`, ...(sim.value.logs ?? [])],
    };
  }
  const rd = sim.value.returnData;
  if (!rd) throw new Error("check() did not set return data");
  return decodeCheckResult(Buffer.from(rd.data[0], rd.data[1] as BufferEncoding));
}

export { BN };
