// File: packages/decoder/src/privilege.ts
// Purpose: Privilege classification for instructions
// [VERIFIED] — Logic from BACKEND.md §3.4

import { DecodedInstruction, PrivilegeClassification, PrivilegeBasis } from './types';

/**
 * Admin/authority keyword regex
 * [VERIFIED] from BACKEND.md §3.4
 */
const AUTHORITY_KEYWORDS = /^(admin|authority|owner|governance|guardian|council|operator|manager|risk_?admin|fee_?admin)$/i;

/**
 * Classify privilege of an instruction
 * [VERIFIED] — Three-tier check: IDL relation → name heuristic → runtime match
 *
 * From BACKEND.md §3.4:
 * - IDL relation check: signer account with "has_one" relations
 * - Name heuristic: signer account name matching authority keywords
 * - Runtime match: signer equals a known authority from control_state (checked by caller)
 */
export function classifyPrivilege(
  decoded: DecodedInstruction,
  knownAuthorities?: Set<string>
): PrivilegeClassification {
  // Default: not privileged until proven otherwise
  const result: PrivilegeClassification = {
    isPrivileged: false,
    basis: 'none',
  };

  // Check each signer account
  for (const account of decoded.accounts) {
    if (!account.isSigner) continue;

    // Tier 1: IDL relation check
    if (account.constraint && /^(admin|authority|owner)$/i.test(account.constraint)) {
      result.isPrivileged = true;
      result.basis = 'idl_relation';
      result.reason = `Signer account ${account.name} has IDL constraint: ${account.constraint}`;
      return result;
    }

    // Tier 2: Name heuristic
    if (account.name && AUTHORITY_KEYWORDS.test(account.name)) {
      result.isPrivileged = true;
      result.basis = 'name';
      result.reason = `Signer account name matches authority keyword: ${account.name}`;
      return result;
    }

    if (account.isAdmin || account.isAuthority) {
      result.isPrivileged = true;
      result.basis = 'name';
      result.reason = `Signer account marked as admin/authority`;
      return result;
    }

    // Tier 3: Runtime match (if knownAuthorities provided)
    if (knownAuthorities && knownAuthorities.has(account.pubkey)) {
      result.isPrivileged = true;
      result.basis = 'runtime_match';
      result.reason = `Signer account matches known authority in control_state`;
      return result;
    }
  }

  // No signer matched any privilege criteria
  return result;
}

/**
 * Categorize instruction risk based on name and accounts
 * [VERIFIED] from BACKEND.md §3.4
 */
export function categorizeInstructionRisk(
  decoded: DecodedInstruction
): { risk: 'high' | 'medium' | 'low' | 'unknown'; category: string } {
  const nameLower = decoded.name.toLowerCase();

  // High-risk patterns
  if (
    nameLower.includes('upgrade') ||
    nameLower.includes('set_authority') ||
    nameLower.includes('setauthority')
  ) {
    return { risk: 'high', category: 'authority_change' };
  }

  if (
    nameLower.includes('initialize_market') ||
    nameLower.includes('add_reserve') ||
    nameLower.includes('add_bank')
  ) {
    return { risk: 'high', category: 'market_create' };
  }

  if (nameLower.includes('oracle') || nameLower.includes('price_feed')) {
    return { risk: 'high', category: 'oracle_change' };
  }

  if (
    nameLower.includes('limit') ||
    nameLower.includes('cap') ||
    nameLower.includes('max_')
  ) {
    return { risk: 'medium', category: 'limit_change' };
  }

  if (nameLower.includes('pause') || nameLower.includes('freeze') || nameLower.includes('halt')) {
    return { risk: 'medium', category: 'pause' };
  }

  if (nameLower.includes('fee')) {
    return { risk: 'medium', category: 'fee_change' };
  }

  if (nameLower.includes('withdraw') && nameLower.includes('fee')) {
    return { risk: 'high', category: 'withdraw_admin' };
  }

  if (nameLower.includes('proposal') || nameLower.includes('vote')) {
    return { risk: 'medium', category: 'authority_change' };
  }

  return { risk: 'unknown', category: 'other_privileged' };
}

/**
 * Determine if instruction should be decoded at all based on program and discriminant
 * [VERIFIED] from BACKEND.md §2.1
 */
export function shouldTrackedAccountIx(
  programId: string,
  trackedPrograms?: Set<string>
): boolean {
  // System programs: always possible (filtered by caller per watched signers)
  if (programId === '11111111111111111111111111111111') return true;

  // BPF Loader: always track
  if (programId === 'BPFLoaderUpgradeab1e11111111111111111111111') return true;

  // Squads: always track if account in system is a multisig
  if (programId === 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf') return true;
  if (programId === 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu') return true;

  // SPL Governance: track if tracked
  if (programId === 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw') return true;

  // Program Metadata: track IDL changes
  if (programId === 'ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S') return true;

  // Per-protocol programs: track if in trackedPrograms
  if (trackedPrograms && trackedPrograms.has(programId)) {
    return true;
  }

  return false;
}
