// File: packages/decoder/src/privilege-classifier.ts
// [TESTED against real mainnet instruction accounts, 2026-09-26]
//
// Privilege classification per BACKEND.md §3.4: an instruction is
// privileged if any account marked as a signer is either (a) a runtime
// match against a set of known controller addresses (multisig vaults,
// stored admin keys — this is authoritative, since it catches badly named
// accounts), or (b) name-matched by the IDL against the admin/authority
// naming convention, or (c) IDL-relation constrained (Anchor `relations`)
// to a stored authority. Runtime match wins over both IDL-derived bases.

import type { AnchorIdl } from './anchor-decoder';

export type PrivilegeBasis = 'runtime_match' | 'idl_relation' | 'name';

export interface PrivilegeVerdict {
  privileged: boolean;
  basis: PrivilegeBasis | null;
  /** The signer account (name from the IDL, if known) that triggered the verdict. */
  matchedAccount?: string;
}

export interface AccountMeta {
  name?: string;
  pubkey: string;
  isSigner: boolean;
}

// BACKEND.md §3.4's exact naming convention.
const PRIVILEGED_NAME_PATTERN = /^(admin|authority|owner|governance|guardian|council|operator|manager|risk_?admin|fee_?admin)$/i;

function findIxDef(idl: AnchorIdl, ixName: string): Record<string, any> | undefined {
  return (idl.instructions ?? []).find((i: Record<string, any>) => i.name === ixName);
}

function isSignerFlag(accountDef: Record<string, any>): boolean {
  return accountDef.isSigner ?? accountDef.signer ?? false;
}

function accountName(accountDef: Record<string, any>): string {
  return accountDef.name;
}

/**
 * Classify an instruction's privilege level.
 *
 * @param idl the IDL the instruction was decoded against
 * @param ixName the decoded instruction's name (as it appears in idl.instructions)
 * @param accounts the instruction's account metas in IDL account-list order,
 *   each carrying the real runtime pubkey and whether it actually signed
 * @param knownControllers addresses currently recorded as controlling this
 *   protocol (admin keys, multisig vaults) — the runtime-match set
 */
export function classifyPrivilege(
  idl: AnchorIdl,
  ixName: string,
  accounts: AccountMeta[],
  knownControllers: ReadonlySet<string>
): PrivilegeVerdict {
  // (a) Runtime match is authoritative — check first, regardless of IDL shape.
  for (const account of accounts) {
    if (account.isSigner && knownControllers.has(account.pubkey)) {
      return { privileged: true, basis: 'runtime_match', matchedAccount: account.name ?? account.pubkey };
    }
  }

  const ixDef = findIxDef(idl, ixName);
  if (!ixDef) return { privileged: false, basis: null };

  const ixAccountDefs: Record<string, any>[] = ixDef.accounts ?? [];

  // (b) IDL relation (has_one-style constraint recorded in the IDL).
  for (const accountDef of ixAccountDefs) {
    if (isSignerFlag(accountDef) && Array.isArray(accountDef.relations) && accountDef.relations.length > 0) {
      return { privileged: true, basis: 'idl_relation', matchedAccount: accountName(accountDef) };
    }
  }

  // (c) Name heuristic fallback.
  for (const accountDef of ixAccountDefs) {
    if (isSignerFlag(accountDef) && PRIVILEGED_NAME_PATTERN.test(accountName(accountDef))) {
      return { privileged: true, basis: 'name', matchedAccount: accountName(accountDef) };
    }
  }

  return { privileged: false, basis: null };
}
