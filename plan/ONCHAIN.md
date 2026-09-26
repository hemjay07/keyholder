# ONCHAIN.md — the control-policy program (brief part 8)

Status: **designed** (nothing built). Date 2026-09-26. Working name: `ctrl_policy` (program), `ControlGuard` (brand).

Sources verified this session (via `gh api`, 2026-09-26):
- [S1] Squads v4 `Multisig` account: github.com/Squads-Protocol/v4 `programs/squads_multisig_program/src/state/multisig.rs` (fields, `size()`, `Member`, `Permissions`, `MAX_TIME_LOCK = 3 months`).
- [S2] Squads v4 seeds: same repo `src/state/seeds.rs` (`"multisig"`, `"vault"`), vault PDA = `["multisig", multisig, "vault", vault_index: u8]` (`instructions/vault_transaction_execute.rs` L102-106).
- [S3] Loader v3 state: github.com/anza-xyz/solana-sdk `loader-v3-interface/src/state.rs` (`UpgradeableLoaderState::ProgramData { slot: u64, upgrade_authority_address: Option<Pubkey> }`, metadata size 45, program account size 36).
- [S4] Toolchain: `gh api repos/solana-foundation/anchor/releases/latest` → **v1.2.0** (2026-09-04); `repos/anza-xyz/agave/releases/latest` → **v4.3.0** (2026-09-18).
- [S5] Brief facts (Drift sequence, OtterSec verify program id, sas-lib 1.0.10): /Users/mujeeb/controlplane/plan/BRIEF.md and research/11-sketch-upgrade-watch.md.

Anything else is marked ASSUMPTION.

---

## Constraints summary
- Timeline: 16 days to 2026-10-13T06:59Z, program is one of 9 parts; program work budget ~8 focused days.
- Team: solo founder, first Anchor program, AI pair.
- Stack: Anchor v1.2.0 / Agave v4.3.0 [S4]; TS client; indexer (Next.js/TS) already planned elsewhere.
- Deployment: devnet by day 3, mainnet by day 12 (program deploy costs ~ rent for ~250-350 KB ≈ 2-2.5 SOL, ASSUMPTION on final size).
- Scale: read-mostly; `check` is called inside other programs' hot paths, so its CU cost is the product.
- Non-negotiables: real CPI building block, eat-our-own-cooking upgrade control.

---

## 1. Purpose, threat model, trust

### What it is
A program that (a) keeps an on-chain, timestamped record of each watched program's control state, most of it **derived trustlessly from account reads**, and (b) exposes `check(policy)` that an integrator CPIs before moving money into a target. `check` fails the integrator's transaction if control of the target is weaker than the integrator's policy, or got weaker too recently.

### What it protects against (Drift pattern, [S5])
| Drift step | Signal | How ControlGuard sees it | Trust |
|---|---|---|---|
| Durable nonces created by signers (03-23) | nonce accounts with authority = member key | attester only (cannot enumerate on-chain) | attester |
| Threshold 3-of-5 → 2-of-5 | Squads `threshold` drop, `stale_transaction_index` bump [S1] | live read of multisig account + recorded `last_weakened_slot` | trustless |
| Zero timelock | Squads `time_lock == 0` [S1] | live read | trustless |
| Admin handed to multisig with new config | ProgramData authority change [S3], or protocol admin-account change | ProgramData: trustless. Protocol admin field: attester (program-specific layout) | mixed |
| Malicious market created, caps raised | privileged admin ix decoded by indexer | attester sets `risk_level` / `admin_action_slot` | attester |
| Drain in 128 s | — | too late for a policy check; the value is refusing *new* deposits/rebalances into the weakened target during the 9 days before | — |

### What it cannot protect against
- Protocols not integrating it: `check` only protects funds whose mover calls it (vaults, curators, routers, wallets via simulation).
- Theft of already-deposited funds by a compromised admin: it gates inflows and rebalances, not the target's own withdrawals.
- Key compromise without any on-chain config change (Raydium 2022 style stolen key with the same authority). Only "single key = high risk" static policy helps.
- Changes made and executed inside one crank gap if nobody refreshes: mitigated because `check` reads live accounts every time (see §5), so current state is never stale; only *history* ("weakened in last N days") depends on someone having observed it.
- Attester lies about attester-only facts (nonces, admin ix, verified-build) — bounded by §7.
- Bugs in the target's own code.

### Trust assumptions and path to trustlessness
- **v1 (hackathon)**: facts split into `Derived` (program reads) and `Attested` (indexer key signs). Integrators choose in their policy whether attested facts count (`require_attested_ok: bool`). Attester = one ed25519 key held by the indexer, registered in `AttesterRegistry` by the governance multisig.
- **v2**: M-of-N attesters: `AttestedFacts` written only when `quorum` distinct registered attesters submit the same `facts_hash` within a window (pending-vote account per (target, facts_hash)).
- **v3**: move more facts to `Derived`: per-protocol admin-account readers (layout descriptors: offset+length of the admin pubkey field in, e.g., a Drift `State` account, registered per protocol under timelocked governance) — the program then reads admin fields itself. Verified-build cannot become trustless on-chain (hash of a rebuild is off-chain compute); it stays attested (OtterSec's own attestation, or ours).

What a program can verify by itself (account reads, no trust):
| Fact | Account | Notes |
|---|---|---|
| upgrade authority, last deploy slot | ProgramData [S3] | exact; `None` ⇒ immutable |
| program → ProgramData link | Program account [S3] | verify `programdata_address` and the PDA `[program_id]` under loader |
| authority is a Squads vault | recompute `["multisig", ms, "vault", idx]` under SQDS4… [S2] | exact |
| threshold, time_lock, members, config_authority, stale_transaction_index | Squads `Multisig` [S1] | exact; owner must be SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf |
| voter count (threshold vs voters) | members + permission mask [S1] | exact |
| protocol admin field | protocol state account | only with a registered layout descriptor (v3) |
| verified-build | OtterSec PDA existence only | existence of a build-params PDA ≠ match; match stays attested (ASSUMPTION on OtterSec PDA seeds, not verified) |
| durable nonces by signers, pending proposals, privileged admin ix | — | attested (needs history/enumeration) |

---

## 2. Accounts

All Anchor accounts (8-byte discriminator). Fixed sizes, no Vec in hot-path accounts.

### `Config` — PDA `["config"]`
```rust
pub struct Config {           // 8 + 32+32+8+1+1 = 82 -> alloc 128
    pub governance: Pubkey,   // Squads vault of our own multisig
    pub pending_governance: Pubkey,
    pub max_attest_staleness_slots: u64, // global floor
    pub paused_attestations: bool,       // kill switch for attested writes only; never blocks Derived
    pub bump: u8,
}
```

### `ControlState` — PDA `["control", target_program]` (one per watched program; "protocol" = set of these, grouped off-chain)
```rust
#[repr(u8)] pub enum KeyType { Immutable=0, SingleKey=1, SquadsV4=2, OtherMultisig=3, Unknown=4 }

pub struct ControlState {                 // size below
    pub version: u8,                      // layout version (=1)
    pub bump: u8,
    pub target_program: Pubkey,           // 32
    pub programdata: Pubkey,              // 32
    // ---- Derived (written only by permissionless `refresh`) ----
    pub upgrade_authority: Pubkey,        // 32, default() if immutable
    pub key_type: u8,
    pub multisig: Pubkey,                 // 32, default() unless SquadsV4
    pub vault_index: u8,
    pub threshold: u16,
    pub voters: u16,
    pub members_count: u16,
    pub members_hash: [u8; 32],           // sha256(sorted member keys ‖ masks)
    pub time_lock: u32,                   // seconds
    pub config_authority: Pubkey,         // 32; non-default = "controlled multisig" (weaker)
    pub stale_tx_index: u64,              // Squads config-change counter [S1]
    pub last_deploy_slot: u64,            // ProgramData.slot
    pub last_change_slot: u64,            // any derived field changed
    pub last_weakened_slot: u64,          // change that lowered score (threshold↓, time_lock↓, authority→single, members churn)
    pub last_refresh_slot: u64,
    pub derived_score: u8,                // 0..100 computed on-chain from derived facts
    // ---- Attested (written by attester/quorum) ----
    pub verified_build: u8,               // 0 unknown,1 verified,2 unverified-after-upgrade,3 never
    pub risk_level: u8,                   // 0 low .. 3 critical (attester's overall call)
    pub attested_flags: u32,              // bit0 signer-nonce-seen, bit1 pending-config-proposal, bit2 privileged-admin-ix, bit3 admin-account-changed
    pub attested_event_slot: u64,         // slot of latest attested risk event
    pub attested_at_slot: u64,
    pub attester: Pubkey,                 // who wrote attested part last
    pub attest_seq: u64,                  // monotonic, replay guard
    pub reserved: [u8; 64],
}
// 8 disc + 1+1+32+32+32+1+32+1+2+2+2+32+4+32+8+8+8+8+8+1 +1+1+4+8+8+32+8 +64 = 8+288+62+64 = 422 -> alloc 424
```
Rent ≈ 0.0038 SOL each (ASSUMPTION: 6.96e-3 SOL/KB rent-exempt ratio). Paid by whoever calls `register_target` (us).

### `Policy` — PDA `["policy", owner, policy_id: u64 le]`, owned by the integrator
```rust
pub struct Policy {                        // 8 + 32+8+1+1 + 2+4+1+8+8+8+1+1+1+1+32 +32 = ~150 -> 160
    pub owner: Pubkey,                     // integrator authority (their own multisig ideally)
    pub policy_id: u64,
    pub version: u8, pub bump: u8,
    pub min_threshold: u16,                // e.g. 3
    pub min_time_lock: u32,                // seconds, e.g. 86_400
    pub allow_single_key: bool,
    pub cooldown_after_weaken_slots: u64,  // "refuse if weakened in last N slots"
    pub cooldown_after_deploy_slots: u64,  // "refuse if upgraded in last N slots" (0 = off)
    pub max_refresh_age_slots: u64,        // history freshness requirement (0 = don't care)
    pub require_attested_ok: bool,         // include attested facts
    pub max_risk_level: u8,
    pub require_verified_build: bool,
    pub mode: u8,                          // 0 = Enforce (error), 1 = Report (return data only)
    pub policy_update_timelock_slots: u64, // policy loosening is itself timelocked
    pub pending_hash: [u8; 32],            // staged loosening
}
```
Policies are tightenable instantly, loosenable only after `policy_update_timelock_slots` (prevents a compromised integrator key from silently disabling the guard the moment before an attack — the same lesson applied to our users).

### `AttesterRegistry` — PDA `["attesters"]`
```rust
pub struct AttesterRegistry {   // 8 + 1 + 1 + 8*(32+1+8) + 8 = 346 -> 352
    pub quorum: u8,             // v1 = 1
    pub count: u8,
    pub attesters: [AttesterEntry; 8],
    pub epoch: u64,             // bumped on any change; invalidates pending votes
}
pub struct AttesterEntry { pub key: Pubkey, pub active: bool, pub added_slot: u64 }
```
### `PendingAttestation` (v2 only) — PDA `["vote", target, facts_hash]`: votes bitmap u8, first_slot, epoch.

---

## 3. Instructions

| Ix | Signer | Effect |
|---|---|---|
| `init_config(governance)` | deployer, once | creates Config + AttesterRegistry |
| `set_governance / accept_governance` | governance | two-step |
| `add_attester / remove_attester / set_quorum` | governance | bumps `epoch` |
| `register_target(target_program)` | anyone (pays rent) | creates ControlState, runs `refresh` logic |
| `refresh(target)` | **anyone** | reads Program, ProgramData, optional Squads multisig; rewrites Derived; updates `last_change_slot`/`last_weakened_slot`; emits `ControlChanged` event |
| `attest(target, facts: AttestedFacts, seq)` | registered attester | writes Attested part; `seq` must be > `attest_seq`; rejected if `paused_attestations` |
| `create_policy / tighten_policy` | owner | immediate |
| `stage_loosen_policy / apply_loosen_policy` | owner | timelocked |
| `close_policy` | owner | rent back |
| `close_target` | governance | only if target program closed (ProgramData gone) |
| `check(policy)` | none | see below |

### `check` — exact signature
```rust
pub fn check(ctx: Context<Check>) -> Result<()>

#[derive(Accounts)]
pub struct Check<'info> {
    pub policy: Account<'info, Policy>,
    #[account(seeds=[b"control", target_program.key().as_ref()], bump = control.bump)]
    pub control: Account<'info, ControlState>,
    /// CHECK: executable program account; key checked == control.target_program
    pub target_program: UncheckedAccount<'info>,
    /// CHECK: owner == BPFLoaderUpgradeab1e11111111111111111111111; key == control.programdata
    pub programdata: UncheckedAccount<'info>,
    /// CHECK: optional; required iff live authority is a Squads vault. owner == SQDS4…
    pub multisig: Option<UncheckedAccount<'info>>,
}
```
Logic (in this order, cheapest first):
1. Parse ProgramData header (45 bytes) [S3] — **live**. If `slot != control.last_deploy_slot` or authority ≠ stored → the stored history is stale: treat as "changed now" (`weakened_at = current slot` if weaker) — this is what makes staleness safe.
2. If authority is a Squads vault: require `multisig` account, verify owner, recompute vault PDA with `control.vault_index` (≈1 `create_program_address` ≈ 1.5k CU, ASSUMPTION), zero-copy read `threshold` (offset 8+32+32 = 72, u16), `time_lock` (74, u32), `stale_transaction_index` (86, u64), members len (at 8+32+32+2+4+8+8+1+32+1 = 128) [S1 size()]. Count voters by walking members (33 bytes each).
3. Evaluate policy: key type allowed, `threshold >= min_threshold`, `time_lock >= min_time_lock`, no config_authority unless allowed, `now - last_weakened_slot >= cooldown`, deploy cooldown, refresh age, attested facts if required (and `now - attested_at_slot <= max_attest_staleness_slots`, else fail-closed).
4. Result: always `set_return_data(CheckResult)`; in Enforce mode, `err!` with a specific code on first failure.

```rust
#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CheckResult { pub ok: bool, pub reasons: u32 /*bitmask*/, pub derived_score: u8,
                         pub threshold: u16, pub time_lock: u32, pub last_weakened_slot: u64 }
#[error_code] pub enum GuardError {
  #[msg("single-key authority")] SingleKey = 6000, ThresholdBelowPolicy, TimelockBelowPolicy,
  RecentlyWeakened, RecentlyUpgraded, ControlledMultisig, UnknownAuthority, AttestationStale,
  RiskTooHigh, NotVerified, MultisigAccountMissing, AccountMismatch, RefreshTooOld }
```
Why both: errors abort atomically (what vaults want); return data lets routers/wallets choose (Report mode) and lets simulation show all reasons at once. Stable error codes are part of the public ABI — never renumber.

CU budget for `check`: target **≤ 8,000 CU** with Squads (≤ 4,000 without). Estimate: Anchor account deserialization of Policy+ControlState ~2-3k, PDA recompute ~1.5k, member walk for 10 members <1k, logic <0.5k, return data ~0.2k (ASSUMPTION; measured on day 5 with LiteSVM `compute_units_consumed`, and the number published). Use `AccountLoader` (zero_copy) for ControlState if measurement > 8k. No `msg!` in `check` except on failure.

`refresh` is permissionless and cheap to crank: our indexer calls it within seconds of seeing a loader/Squads tx (it already watches them), anyone else can too; a keeper bounty is out of scope.

---

## 4. CPI integration

### Anchor vault (Kamino-style) calling `check` before deposit/rebalance
```rust
// Cargo: ctrl_policy = { version = "0.1", features = ["cpi"] }
pub fn rebalance(ctx: Context<Rebalance>, amount: u64) -> Result<()> {
    let cpi = CpiContext::new(
        ctx.accounts.guard_program.to_account_info(),
        ctrl_policy::cpi::accounts::Check {
            policy: ctx.accounts.guard_policy.to_account_info(),
            control: ctx.accounts.guard_control.to_account_info(),
            target_program: ctx.accounts.target_market_program.to_account_info(),
            programdata: ctx.accounts.target_programdata.to_account_info(),
            multisig: ctx.accounts.target_multisig.as_ref().map(|a| a.to_account_info()),
        });
    ctrl_policy::cpi::check(cpi)?;            // Enforce mode: bubbles GuardError, tx reverts
    // ... move funds ...
    Ok(())
}
#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(address = VAULT_GUARD_POLICY)]  // pin the policy: caller cannot swap in a lax one
    pub guard_policy: Account<'info, ctrl_policy::Policy>,
    /// CHECK: validated by guard
    pub guard_control: UncheckedAccount<'info>,
    /// CHECK: must equal the market's program id the vault is about to CPI into
    #[account(address = reserve.program_id)] pub target_market_program: UncheckedAccount<'info>,
    /// CHECK: validated by guard
    pub target_programdata: UncheckedAccount<'info>,
    pub target_multisig: Option<UncheckedAccount<'info>>,
    #[account(address = ctrl_policy::ID)] pub guard_program: Program<'info, ctrl_policy::program::CtrlPolicy>,
    // ...
}
```
Integrator pitfalls to document: pin `policy` by address or by `has_one = owner`; bind `target_program` to the program you actually CPI into (otherwise a caller passes a well-controlled decoy). Report mode: read `get_return_data()` and check `program_id == ctrl_policy::ID`.

Non-Anchor (native/Pinocchio) integrators: build the ix manually (8-byte `global:check` sighash, 5 accounts, `None` optional account = pass the guard program id per Anchor's optional-account convention).

### TypeScript client (sketch; @coral-xyz/anchor or Codama-generated, ASSUMPTION on which package name Anchor 1.x ships under — verify day 1)
```ts
export async function checkIx(p: Program<CtrlPolicy>, policy: PublicKey, target: PublicKey) {
  const [control] = PublicKey.findProgramAddressSync([Buffer.from("control"), target.toBuffer()], p.programId);
  const [programdata] = PublicKey.findProgramAddressSync([target.toBuffer()], BPF_UPGRADEABLE_LOADER);
  const cs = await p.account.controlState.fetch(control);
  const multisig = cs.keyType === KeyType.SquadsV4 ? cs.multisig : null;
  return p.methods.check().accountsPartial({ policy, control, targetProgram: target, programdata, multisig }).instruction();
}
```
### Simulate-before-sign helper (wallets, dapps, agents)
```ts
export async function guardSimulate(conn: Connection, tx: VersionedTransaction, policy: PublicKey): Promise<GuardReport[]> {
  // 1. collect invoked program ids from tx (top-level + ALT-resolved) excluding system/token/ComputeBudget
  // 2. for each target with a ControlState: build a Report-mode check ix; pack all into one unsigned tx
  // 3. conn.simulateTransaction(v0tx, { sigVerify:false, replaceRecentBlockhash:true })
  // 4. decode each ix's returnData (last one only is returned by RPC -> run one sim per target, in parallel)
  // 5. map reasons bitmask -> human strings ("Threshold dropped 3→2 six days ago; timelock 0")
}
```
Note: RPC `simulateTransaction` returns only the final return data, hence one simulation per target (verify, ASSUMPTION). The helper uses a public "wallet default" Policy we create (e.g. min_threshold 2, min_time_lock 0, cooldown 7 days) so wallets need no account of their own.

---

## 5. Direct verification (layouts)

ProgramData (bincode, [S3]):
```
[0..4]   u32 enum tag = 3 (ProgramData)
[4..12]  u64 slot                       -> last_deploy_slot
[12]     u8 Option tag (0 None / 1 Some)
[13..45] Pubkey upgrade_authority        (present iff tag==1)
[45..]   ELF
```
Program account: `[0..4]` tag = 2, `[4..36]` programdata_address. ProgramData address = PDA(`[program_id]`, loader) — verify both ways.

Squads v4 `Multisig` (Anchor borsh, [S1]; offsets computed from `size()`):
```
0   disc[8]
8   create_key Pubkey
40  config_authority Pubkey      (default() = autonomous; else "controlled", policy flag)
72  threshold u16
74  time_lock u32                (seconds, max 3 months)
78  transaction_index u64
86  stale_transaction_index u64  (bumps on members/threshold/time_lock change => trustless change counter)
94  rent_collector Option tag u8
95  rent_collector Pubkey (always 32 bytes reserved per size() comment — ASSUMPTION that serialized layout also keeps 32 bytes when None; borsh normally does NOT. Parse by tag: if 0, next field at 95)
..  bump u8
..  members len u32, then Member{ key Pubkey, permissions.mask u8 (Initiate=1, Vote=2, Execute=4) } * n
```
Because borsh `Option::None` serializes 1 byte, `check` must parse sequentially after offset 94, not with fixed offsets for fields beyond it. Fixed offsets up to 94 are safe. Owner check (SQDS4…) and discriminator check (`sha256("account:Multisig")[..8]`) are mandatory before reading.

Vault → multisig binding: `create_program_address(["multisig", ms, "vault", [vault_index], [bump]], SQDS4…) == upgrade_authority` [S2]. `refresh` finds `vault_index`/bump by trying indices 0..=3 (ASSUMPTION: protocols use vault 0; indexer passes the index hint).

Derived score (on-chain, deterministic, published formula): immutable 100; single key 10; Squads: base 30 + 10·min(threshold,5) + time_lock tier (0 / ≥1h +10 / ≥24h +20 / ≥72h +25) − 15 if config_authority set − 10 if threshold·2 ≤ voters... capped 0..100. Documented so anyone can recompute.

Squads v3 / other multisigs / governance programs (Realms): `key_type = OtherMultisig`, facts attested only in v1.

---

## 6. SAS (Solana Attestation Service) vs own accounts

| | Own `ControlState` | SAS attestation (sas-lib 1.0.10) |
|---|---|---|
| CPI read cost in `check` | fixed layout, zero-copy, ~1-2k CU | schema-driven dynamic layout, parse cost higher, extra account (credential/schema) validation (ASSUMPTION) |
| Holds Derived facts | yes (program writes itself) | no: SAS attestations are signed by an authorized signer, not derived by a program |
| Discoverability / interop | only our IDL | standard: explorers, wallets, other SAS consumers |
| Expiry | our staleness logic | native expiry field (ASSUMPTION per SAS docs) |

Decision: **own accounts are the source of truth for `check`; mirror attested facts to SAS** (one schema `control_state_v1`, credential = ControlGuard) as a publishing channel for the "public citable record" (part 7). `check` never reads SAS. Runner-up: SAS-only attestation if a SAS-aware integrator demands it — then add a `check_sas` variant. The mirror is a day-14 stretch, not critical path.

---

## 7. Security review of the design

| Attack | Effect | Mitigation |
|---|---|---|
| Attester key stolen → attests "all fine" | integrators with `require_attested_ok` let deposits through on attester-only facts | Derived facts cannot be overridden by attesters (separate write paths); attester can only *raise* risk without quorum? → v1 rule: single attester may raise `risk_level` freely; *lowering* risk or clearing flags needs `quorum` or a `lower_delay_slots` delay (asymmetric trust). Key in HSM/KMS off the indexer box. |
| Attester stolen → attests "critical" everywhere (griefing) | integrators in Enforce mode halt | governance `paused_attestations`; policies choose `require_attested_ok`; `attest` emits events so false alarms are public; per-attester rate limit (ASSUMPTION: needed?) |
| Stale ControlState (nobody refreshed) | history missing a weakening | `check` reads ProgramData + multisig live and treats mismatch with stored as "changed now"; `max_refresh_age_slots` in policy; stale_tx_index mismatch = config changed since last refresh ⇒ weakened-now if current is weaker than stored, else "changed" (conservative: count as change for cooldown) |
| Weaken-then-restore between refreshes (hide history) | cooldown not triggered | stale_tx_index diff catches any Squads config change even if values restored; ProgramData slot catches redeploys. Residual: authority swap A→B→A with no slot change — impossible without SetAuthority tx signed by A; indexer attests `bit3`. |
| Decoy target / wrong multisig passed | pass check for a different program | seeds bind control↔target; ProgramData PDA and vault PDA recomputed; owner+discriminator checks; integrator binds target to its CPI destination (documented pitfall) |
| Policy swap by caller | lax policy used | integrator pins policy address; `check` returns policy key in events |
| Integrator key compromise loosens policy | guard disabled pre-attack | loosen is timelocked + evented; our feed alerts on `PolicyLoosenStaged` for known integrators |
| Squads layout change (Squads upgrades their program) | mis-parse → wrong pass | discriminator + `members.len` bounds + account size cross-check against `Multisig::size(n)`; on any parse anomaly → `UnknownAuthority` (fail closed). We also watch Squads' own ProgramData slot (Squads v4 is on our list) |
| DoS via rent (register spam) | cost to us | `register_target` payer is caller; accounts are per-target PDA (idempotent) |
| CU exhaustion in integrator | `check` too expensive for their tx | measured budget published; members cap 16 walked (more ⇒ attested path) |
| Upgrade of **this** program | we become the single point of control | see below |

### Our own upgrade authority (eat our own cooking)
- Hackathon: deploy with upgrade authority = **Squads v4 vault, 2-of-3** (founder hot, founder cold hardware, a named third party if one agrees — else a second cold key: ASSUMPTION, the founder decides) with **time_lock = 48 h**, `config_authority = default()`. Register ControlGuard itself as a target: its own `check` is callable on itself, and the public page shows our score.
- Post-audit (v1.0): 7-day timelock or make immutable and deploy v2 at a new address for new versions (integrators opt in by address). Recommended: **immutable after audit**, because a guard whose logic can change is itself a control-plane risk; `Policy` ownership stays with integrators.
- Publish verified build (OtterSec `solana-verify`) from day of mainnet deploy; our status must read "verified" on verify.osec.io.

---

## 8. Testing

Framework: **LiteSVM** (Rust, in-process, fast; can load arbitrary account bytes, set clock/slot) as primary; Mollusk for per-instruction CU measurement of `check`; Bankrun not needed (TS) — use LiteSVM's node bindings only if the TS client tests need it (ASSUMPTION: litesvm npm current).

Unit/integration tests (Rust, LiteSVM):
1. ProgramData parsing: immutable, single key, Squads vault; malformed tag; wrong owner.
2. Squads parsing against **real mainnet account bytes** dumped with `solana account SQDS…multisig --output json` (Drift's current Security Council multisig, Squads' own, Kamino's) — fixtures committed.
3. `refresh` detects: threshold↓ (sets `last_weakened_slot`), time_lock↓, members change (hash), config_authority set, redeploy (slot), authority transfer to single key, stale_tx_index bump with same values.
4. `check` matrix: every GuardError reachable, return data matches, Report vs Enforce.
5. Policy loosen timelock; attester monotonic seq; asymmetric raise/lower; governance two-step.
6. CPI test: a tiny `mock_vault` program calling `check` (Enforce reverts deposit).
7. CU: assert `check` ≤ 8,000 (test fails if exceeded).

Fuzz (Trident or cargo-fuzz on pure parsers — parsers are written as pure `fn(&[u8]) -> Result<Parsed>` so they fuzz without an SVM):
- `parse_programdata`, `parse_squads_multisig` (random bytes never panic, never return Ok for wrong discriminator), `score()` monotonicity property (weaker inputs never score higher), policy evaluation (tightening never turns fail→pass).

### Drift replay demo (mainnet-fork style)
Historic account states at 2026-03/04 slots are not fetchable from standard RPC (ASSUMPTION; archival `getAccountInfo` at slot does not exist). So: reconstruct from the on-chain transactions (indexer part 6 already reconstructs the timeline): start from real current program/ProgramData bytes for Drift v2, synthesize the Squads multisig bytes at each step (3-of-5, tl=0 → nonce events attested → 2-of-5 via stale_tx_index bump → admin actions attested), advance LiteSVM clock/slot to the real slots, and run `mock_vault.deposit` into "Drift" after each step. Output: a table/video frame — 03-23 PASS (policy: tl≥0) / attested nonce flag → FAIL `RiskTooHigh` for strict policy; threshold drop → FAIL `RecentlyWeakened` + `ThresholdBelowPolicy`; also `TimelockBelowPolicy` from day 0 for a min_time_lock=24h policy (the honest headline: a 24h-timelock policy would have refused Drift for its whole life). Same script also runs against devnet with a real Squads multisig we control, where we actually lower the threshold live on camera and `check` flips — that is the demo shot (real, not simulated).

---

## 9. Build plan (days relative to 2026-09-27 = D1; deadline D16)

Toolchain [S4]: Anchor **v1.2.0** via `avm install 1.2.0`; Agave/Solana CLI **v4.3.0** (`sh -c "$(curl -sSfL https://release.anza.xyz/v4.3.0/install)"`); Rust as pinned by Anchor 1.2.0's `rust-toolchain`/docs (ASSUMPTION: check the Anchor 1.2 release notes on D1 for the required rustc and platform-tools version and whether Anchor 1.x still uses `anchor-lang` crate name / `@coral-xyz/anchor` TS package — the repo moved to solana-foundation, so names may have changed). Pin all in `rust-toolchain.toml` and `Anchor.toml [toolchain]`.

| Day | Work | Exit check |
|---|---|---|
| D1 | Install, `anchor init`, hello-world deploy to localnet; write pure parsers for ProgramData + Squads with fixture bytes from mainnet | parser unit tests pass on 3 real multisigs |
| D2 | Accounts + `register_target` + `refresh`; LiteSVM tests | refresh detects threshold drop |
| D3 | **Deploy to devnet**; create our own Squads multisig on devnet, set it as authority of a dummy program, `refresh` against it | devnet tx links in PROGRESS |
| D4 | Policy ixs + `check` (Enforce/Report), error codes, return data | check matrix tests |
| D5 | CU measurement (Mollusk), zero-copy if needed; mock_vault CPI test | ≤ 8k CU asserted |
| D6 | Attester registry + `attest` with seq and asymmetric lowering; governance two-step | tests |
| D7 | TS client (Codama/IDL), simulate-before-sign helper; indexer wires `refresh` crank + `attest` | devnet end-to-end: change threshold → feed alert + check fails |
| D8 | Fuzz parsers (cargo-fuzz 1h runs), property tests on score | no crashes |
| D9 | Drift replay harness (LiteSVM) + live devnet flip script | replay table output |
| D10 | Self-review against §7 table; ask one outside Solana dev to review (ASSUMPTION: someone reachable in Superteam NG) | findings list closed |
| D11 | `solana-verify build`, mainnet deploy behind our 2-of-3 48h-timelock Squads; register ~15 targets from brief list | our own ControlState shows "Squads 2-of-3, 48h" |
| D12 | Verify on verify.osec.io; wallet-default policy; docs page "integrate in 10 lines" | verified status |
| D13-14 | SAS mirror (stretch), polish error messages, published CU & score formula | — |
| D15-16 | Buffer only; no program changes after D14 (48h timelock makes late upgrades impossible anyway — by design) | — |

What is hard (for a first Anchor program) and de-risking:
- **Raw account parsing and borsh Option layout** (§5): write parsers as pure functions tested on real bytes on D1 before any Anchor code.
- **Optional accounts and CPI feature wiring**: build the mock_vault early (D5) instead of at the end.
- **Toolchain drift** (Anchor 1.x new, Agave 4.x): lock versions D1; if `anchor build` fails on platform-tools, fall back to the Anchor-recommended Solana version from its release notes, not latest.
- **Mainnet deploy cost/failure**: devnet from D3; mainnet deploy D11 with buffer + `solana program deploy --use-rpc` retry; budget ~3 SOL (ASSUMPTION).
- **Timelock on our own upgrades**: means bugs found after D11 take 48 h to fix — accepted and stated publicly; D12-D14 fixes still land before deadline.
- AI-pair risk: every generated `UncheckedAccount` must carry an explicit owner+key check; add a grep test in CI that fails on `/// CHECK:` without a following constraint.

---

## Risk register
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Squads rent_collector/Option layout misparsed | Med | High | sequential parse, real fixtures, fail-closed |
| `check` CU > budget | Med | Med | zero-copy, members cap, measure D5 |
| Attester trust criticized by judges (Anza/Drift) | High | Med | Derived/Attested split is explicit; trustless path table in docs |
| No real integrator by deadline | High | Med | mock_vault + wallet simulate helper + live devnet flip demo; offer policy templates |
| Toolchain breakage (new Anchor 1.x) | Med | High | pin D1; fallback versions |
| Historical Drift state not replayable exactly | High | Low | reconstructed replay labelled "reconstructed from on-chain txs"; live devnet flip is real |

## Implementation notes
- Build order: parsers → refresh → check → CPI mock → attester → client → replay. Derived path first because it is trustless and demoable without the indexer.
- Keep `check` read-only (no writes) so integrators need no writable accounts and it composes in any tx.
- Events: `ControlChanged{target, field, old, new, slot}`, `Attested`, `PolicyLoosenStaged` — the indexer consumes our own events too.

## Summary
ControlGuard is an Anchor program (Anchor v1.2.0, Agave v4.3.0) that turns the control plane of any Solana program into a policy check other programs can CPI. Its core design choice is splitting facts into **Derived** ones — upgrade authority and last deploy slot from the loader's ProgramData, and threshold, time_lock, members, config_authority and the stale_transaction_index change counter from the Squads v4 Multisig account, all read and verified live inside `check` so they can never be stale or forged — and **Attested** ones (signer durable nonces, privileged admin instructions, verified-build status) written by the indexer's key first, later a quorum, with asymmetric rules so a stolen attester key can raise alarms but cannot quietly clear them. Integrators own timelocked `Policy` accounts ("refuse if threshold < 3, timelock < 24h, or weakened in the last 7 days"), and `check` both reverts with stable error codes and returns a reasons bitmask for simulation, targeting ≤ 8k CU. The program eats its own cooking: upgrade authority is a 2-of-3 Squads vault with a public 48-hour timelock, verified build, and a path to immutability after review. The honest demo is a live devnet threshold drop that flips `check` from pass to fail plus a reconstructed Drift replay showing a 24h-timelock policy would have refused Drift for its whole life; the plan de-risks a first Anchor program by writing and fuzzing the byte parsers on real mainnet fixtures on day 1 and deploying to devnet on day 3.
