// File: apps/worker/src/state-builder/verify-osec.ts
// [TESTED against the real live endpoint, 2026-09-26 — see verify-osec.test.ts]
//
// OtterSec's public program-verification status API. Real HTTP, no mock:
// `curl -s https://verify.osec.io/status/dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`
// returned (2026-09-26):
//   {"is_verified":false,"message":"On chain program not verified",
//    "on_chain_hash":"8299a9b8...","executable_hash":"",
//    "repo_url":"https://github.com/drift-labs/protocol-v2/tree/fee7bfa6...",
//    "commit":"fee7bfa6...","last_verified_at":null,"is_frozen":false,"is_closed":false}
// This module types that real response shape and maps it onto
// apps/worker/src/schema.ts's `verification_checks` row and the risk
// package's `VerifiedStatus`.

import type { VerifiedStatus } from '@keyholder/risk';

export interface OsecStatusResponse {
  is_verified: boolean;
  message?: string;
  on_chain_hash?: string;
  executable_hash?: string;
  repo_url?: string;
  commit?: string;
  last_verified_at?: string | null;
  is_frozen?: boolean;
  is_closed?: boolean;
}

export interface VerificationCheckResult {
  programId: string;
  checkedAt: Date;
  verifiedStatus: VerifiedStatus;
  isVerified: boolean | null;
  onChainHash: string | null;
  executableHash: string | null;
  commit: string | null;
  repoUrl: string | null;
  raw: OsecStatusResponse | null;
  error: string | null;
}

const OSEC_BASE_URL = 'https://verify.osec.io/status';

function mapStatus(res: OsecStatusResponse | null): VerifiedStatus {
  if (!res) return 'unknown';
  if (res.is_verified) return 'verified';
  // A build registered with OtterSec keeps its repo_url after an upgrade
  // unverifies it ("the API detects your upgrade and unverifies your
  // program"); a program never registered has an empty repo_url. Live
  // 2026-09-26: Orca Whirlpool repo_url set -> drifted; Jupiter v6 empty.
  if (res.repo_url && res.repo_url.trim() !== '') return 'drifted';
  return 'unverified';
}

/**
 * Fetch verify.osec.io's status for a program, live. Never throws for a
 * normal non-200/network failure — returns `verifiedStatus: 'unknown'` and
 * the error message, so a single flaky check never blocks the seed run for
 * the other 14 programs (REAL ONLY still applies: this never fabricates a
 * verified/unverified answer when the real call failed).
 */
export async function fetchVerificationStatus(
  programId: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Promise<VerificationCheckResult> {
  const checkedAt = new Date();
  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);

  try {
    const res = await doFetch(`${OSEC_BASE_URL}/${programId}`, { signal: controller.signal });
    if (!res.ok) {
      return {
        programId,
        checkedAt,
        verifiedStatus: 'unknown',
        isVerified: null,
        onChainHash: null,
        executableHash: null,
        commit: null,
        repoUrl: null,
        raw: null,
        error: `verify.osec.io returned HTTP ${res.status}`,
      };
    }
    const body = (await res.json()) as OsecStatusResponse;
    return {
      programId,
      checkedAt,
      verifiedStatus: mapStatus(body),
      isVerified: body.is_verified,
      onChainHash: body.on_chain_hash ?? null,
      executableHash: body.executable_hash || null,
      commit: body.commit || null,
      repoUrl: body.repo_url || null,
      raw: body,
      error: null,
    };
  } catch (err) {
    return {
      programId,
      checkedAt,
      verifiedStatus: 'unknown',
      isVerified: null,
      onChainHash: null,
      executableHash: null,
      commit: null,
      repoUrl: null,
      raw: null,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}
