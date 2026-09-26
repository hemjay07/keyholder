// File: packages/decoder/src/types.ts
// Purpose: Shared types for instruction and account decoders
// [VERIFIED] — Derived from ARCHITECTURE.md §3 and §4 shared types

export type Commitment = 'processed' | 'confirmed' | 'finalized';

// Instruction categories from BACKEND.md §3.4
export type InstructionCategory =
  | 'market_create'
  | 'oracle_change'
  | 'limit_change'
  | 'pause'
  | 'fee_change'
  | 'authority_change'
  | 'withdraw_admin'
  | 'other_privileged'
  | 'unknown';

// Decoded instruction result
export interface DecodedInstruction {
  program: string; // program ID base58
  discriminant: string; // hex string or name
  name: string; // instruction name
  kind: string; // event kind
  category?: InstructionCategory;
  accounts: DecodedAccount[];
  args?: Record<string, any>;
  confidence?: 'high' | 'medium' | 'low';
  raw?: {
    discriminantBytes: Buffer;
    data: Buffer;
  };
}

export interface DecodedAccount {
  name?: string;
  pubkey: string; // base58
  isSigner: boolean;
  isWritable: boolean;
  isMint?: boolean;
  isAuthority?: boolean;
  isAdmin?: boolean;
  constraint?: string; // IDL relation or runtime match
}

// Undecoded result (honest)
export interface UndecodeError {
  discriminant: string; // hex
  reason:
    | 'no_idl'
    | 'idl_outdated'
    | 'discriminant_not_found'
    | 'parse_error'
    | 'unsupported_program';
  programId: string;
  accounts: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>;
}

// IDL-based instruction definition
export interface IdlInstruction {
  name: string;
  discriminator?: number[];
  accounts: IdlAccount[];
  args: IdlField[];
  returns?: any;
}

export interface IdlAccount {
  name: string;
  isMut?: boolean;
  isSigner?: boolean;
  isOptional?: boolean;
  docs?: string[];
  relations?: string[]; // IDL "has_one" relations
  pda?: {
    seeds: Array<{ kind: string; type?: string; account?: string; value?: any }>;
    programId?: { kind: string; type?: string };
  };
}

export interface IdlField {
  name: string;
  type: any; // Can be complex
}

// IDL object from Program Metadata or legacy Anchor
export interface ParsedIdl {
  version: string;
  name: string;
  instructions: IdlInstruction[];
  accounts?: Array<{ name: string; type: { kind: string; fields: any[] } }>;
  events?: any[];
  errors?: any[];
}

// Authority information
export type AuthorityKind = 'immutable' | 'single' | 'squads_v3' | 'squads_v4' | 'spl_gov' | 'unknown';

export interface Authority {
  kind: AuthorityKind;
  address: string; // base58
  multisig?: SquadsMultisig;
}

export interface SquadsMultisig {
  address: string;
  kind: 'v3' | 'v4';
  threshold: number;
  members: string[]; // base58
  timelock_seconds: number;
  config_authority?: string;
  stale_transaction_index?: bigint; // v4 only
}

// ProgramData account state
export interface ProgramDataState {
  slot: number;
  upgrade_authority: string | null; // base58 or null if immutable
  elf_size?: number;
  dataLength?: number;
}

// Event type matching ARCHITECTURE.md §3
export type EventKind =
  | 'upgrade'
  | 'set_authority'
  | 'threshold_changed'
  | 'member_added'
  | 'member_removed'
  | 'timelock_changed'
  | 'config_authority_set'
  | 'proposal_created'
  | 'proposal_executed'
  | 'nonce_created'
  | 'nonce_advanced'
  | 'privileged_ix'
  | 'unknown_privileged_ix'
  | 'verify_status_changed'
  | 'account_changed_undecoded'
  | 'close'
  | 'idl_changed';

// Loader v3 discriminants (from BACKEND.md §2.1)
export const LOADER_V3_DISCRIMINANTS = {
  InitializeBuffer: 0,
  Write: 1,
  DeployWithMaxDataLen: 2,
  Upgrade: 3,
  SetAuthority: 4,
  Close: 5,
  ExtendProgram: 6,
  SetAuthorityChecked: 7,
} as const;

// System Program discriminants
export const SYSTEM_PROGRAM_DISCRIMINANTS = {
  CreateAccount: 0,
  Assign: 1,
  Transfer: 2,
  CreateAccountWithSeed: 3,
  AdvanceNonceAccount: 4,
  WithdrawNonceAccount: 5,
  InitializeNonceAccount: 6,
  AuthorizeNonceAccount: 7,
  Allocate: 8,
  AllocateWithSeed: 9,
  TransferWithSeed: 10,
} as const;

// Program IDs (from BACKEND.md)
export const WELL_KNOWN_PROGRAMS = {
  SYSTEM: '11111111111111111111111111111111',
  LOADER_V3: 'BPFLoaderUpgradeab1e11111111111111111111111',
  SQUADS_V4: 'SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf',
  SQUADS_V3: 'SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu',
  SPL_GOVERNANCE: 'GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw',
  PROGRAM_METADATA: 'ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S',
  TOKEN: 'TokenkegQfeZyiNwAJsyFbPVwwQQfjonMarw24yfbBU',
  RENT: 'SysvarRent111111111111111111111111111111111',
  CLOCK: 'SysvarC1ock11111111111111111111111111111111',
} as const;

// Privilege basis classification (from BACKEND.md §3.4)
export type PrivilegeBasis = 'idl_relation' | 'name' | 'runtime_match' | 'none';

export interface PrivilegeClassification {
  isPrivileged: boolean;
  basis: PrivilegeBasis;
  reason?: string;
  riskCategory?: string; // 'high', 'medium', 'low', 'unknown'
}
