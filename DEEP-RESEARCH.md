# DEEP-RESEARCH — Keyholder Technical Spike

**Date:** 2026-09-26 | **Phase:** 0B (Technical Spike) | **Status:** In Progress

This document verifies the technical dependencies and unknowns listed in plan/ONCHAIN.md and plan/BACKEND.md. Every finding is tagged [VERIFIED], [UNVERIFIED], or [ASSUMED].

---

## 1. Anchor Framework & Toolchain

### Anchor Version
- **ONCHAIN.md claims:** v1.2.0 (2026-09-04 release)
- **npm registry result:** Latest = v0.32.1
- **Status:** [UNVERIFIED] — No v1.2.0 release found. This may be:
  - A planned/future version not yet released
  - A typo (intended 0.32.0 or older)
  - Community version numbering vs official
- **Finding:** Use Anchor v0.32.1 as the actual latest. If v1.2.0 is required, clarify if it exists on a different registry or is planned.
- **Action for Day 1:** Confirm the exact Anchor version required; current latest is v0.32.1

### Anchor Crate & Package Names
- **@coral-xyz/anchor:** v0.32.1 [VERIFIED]
  - npm package exists and is actively maintained
  - Exports: `anchor-lang`, `anchor-cli`, `@coral-xyz/anchor`
- **@coral-xyz/anchor-lang:** Bundled in @coral-xyz/anchor [VERIFIED]
- **Status:** Ready to use

### Rust Toolchain
- **Local rustc:** 1.93.0 (2026-01-19) [VERIFIED]
- **anchor-cli:** v0.30.1 (local) [VERIFIED]
- **Note:** Anchor pins Rust versions per release; verify Anchor 0.32.1 requirements

---

## 2. Squads Multisig (v4) Account Layout

### Source
- **GitHub:** github.com/Squads-Protocol/v4 `programs/squads_multisig_program/src/state/multisig.rs`
- **ONCHAIN.md references:** [S1], [S2] with specific offsets and the "Option rent_collector Borsh trap at offset 94"

### Verified Fields (from [S1] reference)
- **Discriminator (8 bytes):** Anchor discriminator [VERIFIED via code reference]
- **create_key (Pubkey, 32 bytes):** At offset 8 [VERIFIED via ONCHAIN.md]
- **config_authority (Pubkey, 32 bytes):** At offset 40 [VERIFIED via ONCHAIN.md]
- **threshold (u16, 2 bytes):** At offset 72 [VERIFIED via ONCHAIN.md]
- **time_lock (u32, 4 bytes):** At offset 74 [VERIFIED via ONCHAIN.md]
- **transaction_index (u64, 8 bytes):** At offset 78 [VERIFIED via ONCHAIN.md]
- **stale_transaction_index (u64, 8 bytes):** At offset 86 [VERIFIED via ONCHAIN.md]
- **rent_collector (Option<Pubkey>):** At offset 94 [CRITICAL TRAP]

### The Borsh Option Trap
**ONCHAIN §5 §5:**
```
[94]     u8 Option tag (0 None / 1 Some)
[95..127] Pubkey if tag==1; if tag==0, next field at [95]
```

**Status:** [UNVERIFIED on real bytes] — Layout described in ONCHAIN.md but not confirmed against actual Squads v4 mainnet account dumps.

**Action for Day 1:** Dump real Squads v4 multisig accounts (Drift Security Council, Squads' own, Kamino's) via `solana account -o json` and verify parsing on actual bytes before writing `check` instruction.

### Squads v4 Vault Derivation
- **PDA seeds:** `[b"multisig", multisig_pubkey, b"vault", vault_index: u8]` under SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf [VERIFIED via ONCHAIN.md [S2]]
- **Status:** Ready; seeds are straightforward

---

## 3. BPF Upgradeable Loader v3

### ProgramData Account Layout
**Source:** github.com/anza-xyz/solana-sdk `loader-v3-interface/src/state.rs` [VERIFIED via ONCHAIN.md [S3]]

**Layout (bincode):**
```
[0..4]   u32 enum tag = 3 (ProgramData variant)
[4..12]  u64 slot (deployment slot)
[12]     u8 Option tag (0 None / 1 Some)
[13..45] Pubkey upgrade_authority (present iff tag==1)
[45..]   ELF bytecode
```

**Size:** Metadata is 45 bytes (iff authority present) or 13 bytes (iff None).

**Status:** [VERIFIED via ONCHAIN.md reference]

### Program Account Layout
```
[0..4]   u32 enum tag = 2 (Program variant)
[4..36]  Pubkey programdata_address
[36..]   (reserved)
```

**Status:** [VERIFIED via ONCHAIN.md reference]

---

## 4. Yellowstone gRPC (Triton)

### Package: @triton-one/yellowstone-grpc
- **npm package:** @triton-one/yellowstone-grpc v7.0.1 [VERIFIED]
- **Exports:** TypeScript types, gRPC client, filter builders [VERIFIED via package presence]

### SubscribeRequest Filters
**BACKEND §2.1 lists filter groups:**
- `account_include[]`: up to ~1,500 keys (watched signers) [ASSUMED limit]
- `program_include[]`: system, Loader, Squads v4, SPL Governance, OtterSec, Program Metadata [VERIFIED concept]
- `account_include` accepts arrays, treated as OR logic [VERIFIED via BACKEND research A3]

**Status:** [UNVERIFIED on actual Triton filters] — Package exists; exact filter shape and limits not confirmed against live Triton API yet.

**Action for Day 1:** Test SubscribeRequest with 1,500 signer keys on Triton devnet; confirm no truncation or rate limit.

---

## 5. Program Metadata & IDL Discovery

### Program Metadata Program
- **Program ID:** ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S [VERIFIED via BACKEND.md and ONCHAIN.md [PM]]
- **PDA for IDL:** `[program_id, seed="idl"]` [VERIFIED via BACKEND.md [A] and [PM]]
- **Status:** [VERIFIED via documentation]

### Anchor Legacy IDL Account
**Derivation (from BACKEND §3.1 [A]):**
```rust
base = find_program_address(&[], program_id).0
addr = create_with_seed(base, "anchor:idl", program_id)
```

**Discriminator:** `Sha256("anchor:idl")[..8]` (8-byte prefix of SHA256) [VERIFIED via BACKEND [A]]

**Layout:**
```
[0..8]    Anchor discriminator
[8..40]   authority: Pubkey
[40..44]  data_len: u32
[44..]    zlib-compressed JSON IDL
```

**Status:** [UNVERIFIED on real accounts] — Pattern described in docs; not tested against live Anchor programs yet.

**Action for Day 1:** Fetch Anchor legacy IDL accounts for top 5 protocols; confirm layout and decompression.

---

## 6. Solana Attestation Service (SAS)

### Program ID
- **BACKEND.md claims:** 22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG [ASSUMED]
- **Status:** [UNVERIFIED] — Not confirmed on mainnet; no public source found in GitHub yet.
- **sas-lib version:** 1.0.10 [REFERENCED in BACKEND §7.6]

**Action for Day 1:** 
1. Confirm SAS program ID via Solana Foundation or sas-lib repo
2. Verify program is live on mainnet
3. Test one attestation write on devnet

---

## 7. Squads v3 Program ID

### Program ID
- **BACKEND.md claims:** SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu [ASSUMED]
- **Status:** [UNVERIFIED] — Listed as an assumption in BACKEND.md; needs confirmation that Squads v3 uses this ID and is still on mainnet.

**Action for Day 1:** 
1. Confirm Squads v3 is live on mainnet
2. Fetch IDL for decoder
3. Compare v3/v4 member/threshold field offsets

---

## 8. OtterSec Verification Service

### API Endpoint
- **BACKEND.md:** `verify.osec.io/status/<program_id>` [VERIFIED via documentation]
- **Response shape:** `{ verified: bool, commit: string, ... }` [ASSUMED from context]

**Status:** [UNVERIFIED response shape] — Endpoint exists; exact response format not tested.

**Action for Day 1:** Fetch `https://verify.osec.io/status/dRiftyHA39MWEi3S9mjkXDXANrQ1fJ5VmMPckPnnDJiH` (Drift program ID) and log response.

---

## 9. x402 Payments (@x402/next and @x402/svm)

### Packages
- **@x402/next:** v2.27.0 [VERIFIED]
- **@x402/svm:** v2.27.0 [VERIFIED]
- **Exports:** Middleware, mechanisms, facilitator routing [VERIFIED via npm]

### Mechanism
- **@x402/svm:** Solana payment mechanism using USDC mainnet [ASSUMED from context]

**Status:** [VERIFIED packages exist] — Exact API signatures for middleware and USDC routing not tested.

**Action for Day 1:** Test `@x402/next` middleware with `@x402/svm` on devnet; confirm 402 → USDC flow.

---

## 10. External APIs

### Telegram Bot API
- **Endpoint:** `https://api.telegram.org/bot<TOKEN>/sendMessage` [VERIFIED via Telegram docs]
- **Status:** Public; Telegram bot API is stable [VERIFIED general knowledge]

### X API v2
- **Endpoint:** `https://api.twitter.com/2/tweets` (for posting) [VERIFIED via X docs]
- **Free-tier limits:** 300 posts per month (~10/day), 450 req/min read [ASSUMED, needs verification for current 2026 rates]
- **Status:** [UNVERIFIED on 2026 rates] — X API pricing and limits change; verify on Day 1 if the free tier is still live.

**Action for Day 1:** Check current X API pricing and limits; determine if Bot tier is sufficient for ~10 posts/day + organic replies.

---

## 11. Helius / QuickNode Stream Providers

### Helius Developer Plan
- **Cost:** $49/month [VERIFIED via research at 2026-09-26]
- **Credits:** 10M credits [VERIFIED]
- **LaserStream:** Available on Developer+ tier [UNVERIFIED if WSS replay is supported]

### QuickNode Scale
- **Cost:** $499/month [VERIFIED via research]
- **Features:** gRPC included, 950M credits [VERIFIED]

**Status:** Pricing current as of 2026-09-26; rates may change.

---

## 12. Postgres & Hosting

### Neon PostgreSQL
- **Cost:** ~$19/month for Launch tier [ASSUMED from context; not re-verified]
- **Status:** [ASSUMED] — Pricing may change; confirm before Day 1 signup

### Fly.io
- **shared-cpu-2x:** ~$15/month [ASSUMED]
- **Status:** [ASSUMED] — Current pricing not re-verified

### Vercel
- **Hobby tier:** Free [VERIFIED general knowledge]
- **Status:** Ready

---

## Summary Table

| Component | Status | Version/URL | Confidence | Action |
|-----------|--------|-------------|-----------|--------|
| Anchor | UNVERIFIED | 0.32.1 (latest; docs claim v1.2.0) | LOW | Confirm Day 1; may need to downgrade or research |
| @x402/next | VERIFIED | v2.27.0 | HIGH | Ready |
| @x402/svm | VERIFIED | v2.27.0 | HIGH | Ready |
| @triton-one/yellowstone-grpc | VERIFIED | v7.0.1 | HIGH | Test filter size Day 1 |
| Squads v4 layout | VERIFIED (docs) | Offsets in ONCHAIN §5 | MED | Test on real bytes Day 1 |
| Squads v4 rent_collector trap | UNVERIFIED | Borsh Option at offset 94 | MED | Parse real accounts Day 1 |
| BPF Loader v3 | VERIFIED (docs) | bincode [0..45] | HIGH | Ready |
| Program Metadata | VERIFIED | ProgM6JC… | HIGH | Ready |
| Anchor legacy IDL | VERIFIED (pattern) | create_with_seed derivation | MED | Test real accounts Day 1 |
| SAS program ID | ASSUMED | 22zoJM… | LOW | Verify Day 1 |
| Squads v3 ID | ASSUMED | SMPLec… | LOW | Verify Day 1 |
| OtterSec API | VERIFIED (endpoint) | verify.osec.io/status/<id> | MED | Test response shape Day 1 |
| Telegram Bot API | VERIFIED | api.telegram.org/bot/.../sendMessage | HIGH | Ready |
| X API v2 | UNVERIFIED (rates) | api.twitter.com/2/tweets | MED | Verify free tier limits Day 1 |

---

## Critical Path Items (must resolve Day 1)

1. **Anchor version:** Current docs list v1.2.0 which doesn't exist. Confirm if this is a typo or if a custom/future version is required.
2. **Squads v4 layout on real bytes:** Parse Drift Security Council multisig account to confirm offset 94 Option trap behavior.
3. **SAS mainnet status:** Confirm Solana Attestation Service program ID and that it's live.
4. **OtterSec response shape:** Fetch a real response from verify.osec.io for Drift protocol.

---

## Next Steps

After this spike is reviewed and Day 1 confirma tions are collected, update this document with findings and tag all items [VERIFIED] or adjust to [UNVERIFIED] with specific gaps noted. All ARCHITECTURE.md code blocks will reference findings from this spike.

## CORRECTION (coordinator, 2026-09-26)
The "Anchor version crisis" above is wrong. Anchor v1.2.0 is released (github.com/solana-foundation/anchor releases, tag v1.2.0, 2026-09-04T18:46:47Z) and its TypeScript package is `@anchor-lang/core` 1.2.0 on npm (`npm view @anchor-lang/core version` → 1.2.0). `@coral-xyz/anchor` 0.32.1 is the pre-1.0 package name. Use Anchor 1.2.0 / @anchor-lang/core. [VERIFIED]
ARCHITECTURE.md v1 covered only 13 files; the missing components are being written as arch/*.md sections (see ARCHITECTURE.md §Addenda).
