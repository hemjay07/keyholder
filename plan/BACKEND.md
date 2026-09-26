# BACKEND — the control plane of Solana (working title)

Status: **designed** (nothing built). Date 2026-09-26. Deadline 2026-10-13T06:59:59Z (16 days).
Inputs: `/Users/mujeeb/controlplane/plan/BRIEF.md`, `/Users/mujeeb/worldsfair/research/11-sketch-upgrade-watch.md`.

Sources fetched this session (2026-09-26):
- [H] https://www.helius.dev/pricing — Free $0 / 1M credits / 10 RPS; Developer $49 / 10M / 50 RPS, LaserStream gRPC devnet only; Business $499 / 100M / 200 RPS, LaserStream WSS+gRPC; Professional $999 / 200M / 500 RPS. "RPC calls are 1 credit with two exceptions: getProgramAccounts and archival calls are 10 credits." Archival on all plans.
- [Q] https://www.quicknode.com/pricing — Build $49 (80M credits, 50 RPS, gRPC add-on $499); Accelerate $249 (450M, 125 RPS, gRPC add-on $499); Scale $499 (950M, 250 RPS, gRPC included).
- [T] https://triton.one/pricing — PAYG, $125 minimum deposit; RPC $10 per million calls + $0.08/GB; streaming (Yellowstone) $0.08/GB bandwidth only.
- [X] `gh api repos/coinbase/x402` — TypeScript packages `core`, `http/next`, `http/fetch`, `http/paywall`, `mechanisms/svm` exist (so `@x402/next` + `@x402/svm` are real package paths; exact npm names **ASSUMPTION** until `npm view`).
- [A] `gh api repos/coral-xyz/anchor lang/src/idl.rs` — IDL address = `Pubkey::create_with_seed(&program_signer, "anchor:idl", program_id)`, instruction tag `Sha256("anchor:idl")[..8]`. `program_signer` = `find_program_address(&[], program_id)` (**ASSUMPTION** from memory of the same file; confirm on day 1).
- [PM] `gh api repos/solana-program/program-metadata` README — Program Metadata program `ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S`; canonical metadata PDA `[program, seed]` written by the upgrade authority, non-canonical `[program, authority, seed]`; seed `"idl"`; data may be on-chain, at a URL, or in another account. The Anchor docs page now points to this for IDL storage.
- [S4] `gh api repos/Squads-Protocol/v4` — instruction files: `multisig_config` (add/remove member, change threshold, set time_lock, set rent collector, set config authority), `config_transaction_create/execute`, `proposal_create/activate/vote` (approve/reject/cancel), `vault_transaction_create/execute`, `batch_*`, `spending_limit_*`, `program_config*`.
- [SAS] `solana-foundation/solana-attestation-service` exists, built with Shank, clients generated. Program ID and mainnet status **not confirmed this session** (ASSUMPTION `22zoJMtdu4tQc2PzL74ZUT7FrwgB1Udec8DdW4yw4BdG`; verify day 1 with `getAccountInfo`).
- Research file sections A1–A6 (loader discriminants, OtterSec PDA seeds and API, Helius webhooks/Parsed Streams, measured loader firehose ~16,000 tx/h with >98 % `Write`).

---

## 0. Constraints summary

| | |
|---|---|
| Timeline | 16 days to submission, solo; demo video + counts matter as much as code |
| Team | One founder, fluent TS/Next.js, first Anchor program; agents implement |
| Existing stack | None in `controlplane/` yet (only `plan/`). Greenfield |
| Deployment | Mainnet reads; on-chain policy program on mainnet (devnet first); web on Vercel; ingest on an always-on box |
| Scale (honest) | Tracked set ~150 protocols / ~400 programs at launch; loader firehose ~16k tx/h; control events ~10²–10³/day; users: judges + early X followers (<1k) |
| Non-negotiables | Full scope (brief items 1–9); Rust/Anchor program in scope; SURFACE for UI; no purple (UI concern) |

---

## 1. System diagram and service boundaries

One TypeScript monorepo, **one long-running worker process with several in-process "services"** (separate modules, separate queues/tables, independently restartable via process supervisor), plus Next.js on Vercel for the API/UI and one Anchor program. Service boundaries are module + table boundaries, not network boundaries (solo dev; see Decision D1).

```
                       ┌─────────────────────── Solana mainnet ───────────────────────┐
                       │ BPF Upgradeable Loader · Squads v3/v4 · SPL Gov · System     │
                       │ (nonces) · per-protocol programs · OtterSec verify PDAs      │
                       └──────┬──────────────────────────┬───────────────────┬────────┘
            gRPC (Yellowstone, │ tx stream, CONFIRMED)    │ JSON-RPC (HTTP)   │ tx (SAS + policy writes)
            fallback: Helius   │                          │ getAccountInfo,   │
            LaserStream WSS /  │                          │ getSignaturesFor…,│
            RPC poll           ▼                          │ getTransaction    │
┌──────────────────────────────────────────────┐          │                   │
│ WORKER (Fly.io machine / Hetzner, Node 22)   │          │                   │
│                                              │          │                   │
│ [1 ingest] ──raw_tx rows (PG)──▶ [2 decode]  │◀─────────┘                   │
│    │ dedup by (sig, ix_index)      │ IDL cache│                              │
│    │ finality watermark            ▼          │                              │
│    │                       events (PG, typed) │                              │
│    │                               │          │                              │
│    │                               ▼          │                              │
│    │                      [3 state builder]   │  control_state snapshots     │
│    │                               │          │                              │
│    │                               ▼          │                              │
│    │                      [4 risk engine] ──▶ risk_deltas                    │
│    │                               │                                         │
│    │           ┌───────────────────┼──────────────────────────┐              │
│    │           ▼                   ▼                          ▼              │
│    │  [6 alert dispatcher]  [7 attestation writer]──────▶ SAS + policy prog ─┘
│    │   TG / email / webhook   (batch, signed by indexer key)
│    │   / X bot [11]           
│ [5 verification poller] ── HTTPS ─▶ verify.osec.io/status/<id> (+PDA read)   │
│ [12 position resolver] (on demand, via job queue)                            │
│ [10 replay engine] (CLI + job; reads raw_tx archive, writes replay_* tables) │
└──────────────┬───────────────────────────────────────────────────────────────┘
               │ SQL (Postgres 16, Neon or Fly PG)      LISTEN/NOTIFY for live feed
               ▼
┌──────────────────────────────┐   HTTPS JSON / SSE   ┌──────────────────────┐
│ Next.js on Vercel            │◀────────────────────▶│ browser, agents,     │
│ [8 public API] REST + SSE    │   x402 402→200       │ integrators          │
│ [9 x402 routes] @x402/next   │─── facilitator ────▶ PayAI / CDP           │
│ webhooks mgmt, subscriptions │                      └──────────────────────┘
└──────────────────────────────┘
```

| # | Service | Owns (writes) | Reads | Runs where |
|---|---|---|---|---|
| 1 | ingest | `raw_tx`, `ingest_cursor` | stream / RPC | worker |
| 2 | decode | `events`, `idl_versions` | `raw_tx`, IDL accounts | worker |
| 3 | state builder | `control_state`, `authorities`, `multisigs`, `multisig_members`, `nonces`, `program_versions` | `events` | worker |
| 4 | risk engine | `risk_deltas`, `protocol_scores` | `control_state`, `rules` | worker |
| 5 | verification poller | `verification_checks` | OtterSec API + PDA | worker (cron, 10 min) |
| 6 | alert dispatcher | `alerts`, `deliveries` | `risk_deltas`, `subscriptions`, `positions` | worker |
| 7 | attestation writer | `attestations` | `control_state`, `risk_deltas` | worker (batch, 5 min) |
| 8 | public API | nothing (read-only) + `subscriptions`, `webhooks` | all | Vercel |
| 9 | x402 endpoints | `payments` | all | Vercel |
| 10 | replay engine | `replay_runs`, `replay_alerts` | `raw_tx` archive | worker job / CLI |
| 11 | X bot | `x_posts` | `risk_deltas` (severity ≥ medium, tracked protocols) | worker |
| 12 | wallet-position resolver | `positions` (cache) | RPC + protocol SDKs | worker job, triggered by API |
| P | on-chain policy program | `ControlRecord` PDAs | attestations from #7 | Solana |

Queues: **Postgres-backed** (`graphile-worker` or a `jobs` table with `FOR UPDATE SKIP LOCKED`). Pipeline stages hand off by row status (`raw_tx.status = pending|decoded|failed`), so any stage can be re-run from any point — which is exactly what the replay engine needs.

---

## 2. Ingest

### 2.1 Sources and filters

Stream source: Yellowstone `SubscribeRequest.transactions` with `vote:false, failed:false`, commitment CONFIRMED, `account_include` = the list below ("values in arrays as logical OR", research A3). Then filter **in-process by program ID + discriminant** (Yellowstone cannot filter on instruction data). Include inner instructions (CPI) — Squads executes loader `Upgrade` and admin calls via CPI from a vault, so top-level-only matching misses the most important events.

| Source | Program ID | Keep (discriminant / name) | Drop |
|---|---|---|---|
| BPF Upgradeable Loader | `BPFLoaderUpgradeab1e11111111111111111111111` | 2 DeployWithMaxDataLen, 3 Upgrade, 4 SetAuthority, 5 Close, 6 ExtendProgram, 7 SetAuthorityChecked (u32 LE first 4 bytes) | 0 InitializeBuffer, 1 Write (>98 % of volume) |
| Squads v4 | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` | Anchor 8-byte discriminators for: `multisig_create(_v2)`, `multisig_add_member`, `multisig_remove_member`, `multisig_change_threshold`, `multisig_set_time_lock`, `multisig_set_config_authority`, `config_transaction_create/execute`, `vault_transaction_create/execute`, `proposal_create/activate/approve/reject/cancel`, `batch_*`, `spending_limit_*` (IDL from on-chain, [S4]) | none — all Squads ix on *tracked* multisigs; ix on untracked multisigs dropped after account check |
| Squads v3 | `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu` (**ASSUMPTION**, verify) | add/remove member, change threshold, create/approve/execute tx | idem |
| SPL Governance (Realms) | `GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw` + known forks (per-DAO program IDs — Realms lets DAOs deploy their own instance; list per tracked protocol) | CreateProposal, InsertTransaction, SignOffProposal, CastVote, FinalizeVote, ExecuteTransaction, SetGovernanceConfig, SetRealmConfig, SetGovernanceDelegate | deposits/withdrawals of governing tokens |
| System Program | `11111111111111111111111111111111` | ix 6 InitializeNonceAccount, 4 AdvanceNonceAccount, 7 AuthorizeNonceAccount, **only when an account in the ix is in `watched_signers`** (every member key of every tracked multisig + every single-key authority) | everything else |
| Per-protocol programs | from `protocol_programs` (e.g. Drift `dRiftyHA39MWEi3S9mjkXDXANrQ1fJ5VmMPckPnnDJiH`, Kamino Lend, marginfi v2, …) | every ix whose decoded account constraints mark it **privileged** (§3.4) | user ix (deposit, trade) — decoded, counted, not stored beyond 7 days |
| OtterSec verify | `verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC` | all (low volume; PDA init/update = "re-verification requested") | — |
| Program Metadata | `ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S` | writes to canonical `idl` seeds of tracked programs (IDL change) | — |

The System Program cannot be subscribed to wholesale (too large). Nonce detection is done by putting **signer addresses** into `account_include` (a nonce ix references the nonce authority as an account). Size: ~150 protocols × ~5–10 signers ≈ 1,500 keys; Yellowstone filters accept thousands of accounts (**ASSUMPTION**: limit per provider; Triton docs did not state one). Two filter groups: `ctrl` (program IDs) and `signers` (watched keys).

A second, **account** subscription (Yellowstone `accounts` filter) on every ProgramData account, multisig account, and admin/state account of tracked protocols: catches any mutation even if our instruction decoder misses it (defense in depth; state builder diffs account bytes and emits `account_changed_undecoded` if no decoded event explains it).

### 2.2 Provider decision (see D2 matrix below)

Primary: **Triton Yellowstone PAYG** — streaming billed only by bandwidth ($0.08/GB, [T]); filtered stream is small (loader ~16k tx/h × ~1.5 KB ≈ 0.6 GB/day ≈ 17 GB/mo ≈ **$1.4/mo** plus Squads/Gov/signer traffic, estimate <50 GB/mo ≈ $4). RPC calls at $10/M. $125 deposit covers the hackathon. **ASSUMPTION**: Triton issues a PAYG token to a solo developer quickly; if not within 24 h, fall back.
Fallback 1: **Helius Developer $49** — LaserStream WSS `transactionSubscribe` with `accountInclude` ([H]; research A3 says enhanced WSS needs Developer+). 10M credits: webhook events are 1 credit each; loader traffic alone would be ~11.5M/mo so we **do not** point webhooks at the loader; WSS does not bill per event on Developer (**ASSUMPTION**, verify).
Fallback 2 (zero cost): public RPC poll of `getSignaturesForAddress` on each program ID every 10 s + `getTransaction`. Latency ~10–20 s, rate-limited; acceptable for Squads/loader, not for signer-set nonce watch at scale.

Backfill RPC: Helius archival (`getSignaturesForAddress`/`getTransaction` are archival = 10 credits each, [H]) or Triton ($10/M calls). Backfill is the big RPC bill (§2.4).

### 2.3 Monthly cost

| Setup | Stream | RPC (live, ~2M calls/mo for account reads, verification, positions) | Backfill (one-off) | Total/mo |
|---|---|---|---|---|
| Triton PAYG | ~$4 | ~$20 | ~$30 (3M calls) | **~$25 + $30 once** ($125 deposit) |
| Helius Developer | incl. | ~2M credits | ~3M sigs+txs × 10 credits = 30M → needs Business | $49 live; backfill must be throttled over weeks or use Triton |
| Helius Business | LaserStream gRPC | incl. | 100M credits covers it | $499 |
| QuickNode Scale | gRPC incl. | 950M credits | incl. | $499 ([Q]) |
| Public RPC only | poll | free, 429s | days, rate-limited | $0 (demo risk high) |

Hosting worker: Fly.io `shared-cpu-2x` 2 GB ≈ $15/mo or Hetzner CX32 ≈ €7 (**ASSUMPTION** prices, not fetched). Postgres: Neon Launch ≈ $19 or Fly PG. Vercel Hobby/Pro $0–20. ELF object storage: Cloudflare R2 (400 programs × ~5 versions × 500 KB ≈ 1 GB ≈ free tier).
**Cost ceiling: $150/month** all-in during hackathon; alert at 80 % via provider dashboards.

### 2.4 Backfill and state reconstruction

Principle: **control state is a fold over events**. We never trust "current state" alone; we store the event log and fold. Current account reads are used as a **checksum** (fold result at tip must equal `getAccountInfo` decoded), which is how we know backfill is complete.

Per tracked protocol:
1. **Seed (tip):** read ProgramData (`slot`, `upgrade_authority_address`), authority's owner (System → single key; Squads v4 → multisig PDA via vault derivation `[b"multisig", multisig, b"vault", index]`; SPL Gov → governance), multisig config (members, threshold, time_lock, config_authority), admin/state accounts (e.g. Drift `State.admin`) → `control_state` at slot S_tip.
2. **Walk back** with `getSignaturesForAddress(addr, before=…)` on each control account: ProgramData account, the program ID, multisig PDA, each vault, each state/admin account, each member key (for nonces only, bounded window). Fetch each tx, decode, emit events with `source='backfill'`.
3. **How far:** full history of ProgramData + multisig + state/admin accounts (low volume: dozens–thousands of txs each). For member keys (nonce detection) and per-protocol privileged ix: **365 days**. For the per-protocol program ID itself (millions of user txs) we do **not** walk sigs; we walk the admin/state account signature list instead, since every privileged ix writes it.
4. **Fold backward-safe:** events stored with `(slot, tx_index, ix_path)`; state builder folds forward from the earliest event, starting from the reconstructed genesis (the `multisig_create` / `DeployWithMaxDataLen` event). `control_state_at(protocol, slot)` = last snapshot ≤ slot (snapshots written on every change, so O(1) lookup via index).
5. **Checksum:** fold(tip) vs live read; mismatch → `backfill_gap` row + event `unexplained_state_change` (honest, shown in UI).

**Drift March–April 2026 reconstruction** (feeds Replay, brief item 6):
- Accounts: Drift v2 program `dRiftyHA39MWEi3S9mjkXDXANrQ1fJ5VmMPckPnnDJiH`; its ProgramData; Drift `State` account (admin field); the Security Council / admin Squads multisig(s) (old 3-of-5 and new 2-of-5 — address from the `State.admin` history and from rekt.news; **ASSUMPTION** these are Squads v4); each member key of both; the four durable nonce accounts created 2026-03-23 (found by scanning members' signature lists for System ix 6 in 2026-03-20..04-01).
- Window: 2026-03-01 → 2026-04-03 (slot range derived via `getBlockTime` binary search; ~7.3M slots).
- Steps: (a) pull full sig history of State, multisigs, vaults, ProgramData; (b) pull member key sigs for the window; (c) pull the drain txs (18 vaults, 128 s) for the "money moved" terminal events; (d) decode with the **IDL version valid at that slot** (§3.2); (e) run the replay engine (§10) at original timestamps compressed, emitting the alerts the rules would have fired, each with its original slot and "hours before drain".
- Expected events (from rekt.news, to be confirmed from chain): 2026-03-23 `nonce_created` ×4 by council signers; Security Council migration → `threshold_changed 3→2`, `time_lock = 0`; `admin_transferred` to the new multisig; privileged `initialize_spot_market` (malicious collateral); `update_*_withdraw_limit` raises; drain.
- Cost: ~50k archival calls ≈ 500k Helius credits or $0.50 Triton.
- Risk: pruned history on a provider → use Old Faithful / Triton archive or a second provider; **validate on day 2** because Replay is a headline demo.

### 2.5 Reorg / finality, dedup

- Ingest at CONFIRMED (low latency for alerts); every row carries `commitment`. A **finalizer** job re-checks rows older than 32 slots via `getSignatureStatuses`; confirmed→finalized, or `dropped` if missing (Solana confirmed forks are extremely rare but possible).
- Alerts fire at CONFIRMED with label "confirmed"; attestations and X posts fire **only at FINALIZED**. On `dropped`: events tombstoned, state rebuilt from last snapshot before that slot, retraction sent to webhook subscribers (`event: "retracted"`).
- Dedup key: `(signature, ix_path)` unique index where `ix_path` = `"3"` for top-level ix 3, `"3.1"` for inner. Stream + backfill + poll can all write; `ON CONFLICT DO NOTHING`.
- Cursor: `ingest_cursor(source, last_slot)`; on reconnect the worker backfills gap `[last_slot, now]` via `getSignaturesForAddress` on each watched program (Yellowstone `from_slot` replay if the provider supports it; LaserStream has 48 h replay, research A3).

---

## 3. Generic decoding

### 3.1 IDL discovery (per program, in order)
1. **Program Metadata canonical IDL** — PDA `[program_id, "idl"]` under `ProgM6JC…` ([PM]); canonical = written by upgrade authority, trusted. Data may be inline, URL, or pointer account; decompress per the program's format (**ASSUMPTION**: zlib/gzip flag in header; read the client).
2. **Legacy Anchor IDL account** — `base = find_program_address(&[], program_id).0`; `addr = create_with_seed(base, "anchor:idl", program_id)` ([A]). Layout: 8-byte discriminator, `authority: Pubkey`, `data_len: u32`, zlib-compressed JSON.
3. **Non-canonical Program Metadata** by known publishers (e.g. our own uploads for programs we hand-author IDLs for).
4. **Bundled IDLs** in repo (`idls/<program>/<version>.json`) for Shank/native programs we care about: SPL Governance, Squads v3, Raydium AMM v4, Openbook, Jito stake pool (SPL stake-pool) — Codama/Shank IDLs from their repos.
5. None → program is **undecoded**; we still record every ix as `{program, discriminant_hex, accounts, signers}`.

### 3.2 Versioned IDLs across upgrades
`idl_versions(program_id, idl_hash, source, first_seen_slot, valid_from_slot, valid_to_slot)`. On every `Upgrade` event and every IDL-account write we re-fetch and hash. Decoding an ix at slot s uses the version with `valid_from ≤ s < valid_to`. For backfill before our first sighting: use the historical IDL account state via the **IDL account's own tx history** (each `IdlSetBuffer`/`IdlWrite` ix carries the bytes — reconstructable by replaying those txs); if unavailable, decode with the oldest known IDL and mark `decode_confidence='idl_version_guessed'`.

### 3.3 Non-Anchor
- Shank / Codama IDLs: same JSON-ish shape with 1-byte discriminants; one decoder handles both "8-byte Anchor discriminator" and "N-byte enum tag" modes.
- Native programs with no IDL: layouts hand-written only for the programs we must understand (Loader v3, System, SPL Gov, Squads v3). Everything else: undecoded.
- Optional: Sec3 IDL Guesser (research A4) for closed-source programs — out of scope unless time.

### 3.4 Classifying privileged instructions
Rule, applied per instruction definition in an IDL:
- An ix is **privileged** if any account marked `signer: true` in the IDL is *also* constrained to a stored authority: Anchor IDL `relations` / `has_one` (IDL `accounts[i].relations`), or its name matches `/^(admin|authority|owner|governance|guardian|council|operator|manager|risk_?admin|fee_?admin)$/i`, **or** at runtime that signer equals a key currently in `control_state` of the protocol (admin, multisig vault, known authorities).
- Runtime check is authoritative (catches bad naming); name heuristic is the fallback; both recorded in `events.privilege_basis` (`idl_relation | name | runtime_match`).
- Each privileged ix gets a **category** from a keyword map over the ix name + args: `market_create` (initialize_*market, add_reserve, add_bank), `oracle_change` (oracle, price_feed), `limit_change` (cap, limit, max_*), `pause` (pause, freeze, halt), `fee_change` (fee), `authority_change` (set_admin, transfer_authority), `withdraw_admin` (withdraw_*fee, withdraw_pnl — Raydium 2022), `other_privileged`.
- Arg diffs: for `limit_change` etc., state builder reads the target account before/after (from tx `preTokenBalances` isn't enough; use account subscription snapshot or `getAccountInfo` at next slot) to produce "withdraw cap 1M → 100M".

### 3.5 Honest unknowns
Unknown ix on a tracked program where a watched signer signed → event `unknown_privileged_ix` with raw discriminant, severity medium, text: "An account that controls <protocol> signed an instruction we cannot decode (no public IDL)." Never guessed silently. UI shows decode coverage per protocol (`% of privileged ix decoded in last 30 d`).

---

## 4. Data model (Postgres 16)

All IDs are base58 text for keys, `bigint` for slots. Events are append-only.

```sql
protocols(id text pk /*slug*/, name, category, website, x_handle, tvl_usd numeric, tvl_source, updated_at)
programs(program_id text pk, protocol_id fk null, label, programdata_addr, loader text /*v3|immutable|native*/,
         is_executable bool, first_seen_slot bigint, tracked bool default false)
protocol_programs(protocol_id, program_id, role /*core|periphery|oracle*/, pk(protocol_id, program_id))
admin_accounts(account text pk, protocol_id, program_id, kind /*state|config|market*/, admin_field_path text /*e.g. 'admin'*/)

program_versions(program_id, deploy_slot bigint, elf_sha256 bytea, elf_size int, sbpf_version smallint,
                 elf_r2_key text, upgrade_sig text, authority text, verify_status text, verify_commit text,
                 pk(program_id, deploy_slot))
idl_versions(program_id, idl_sha256, source, valid_from_slot, valid_to_slot null, idl_json jsonb, pk(program_id, idl_sha256))

authorities(address text pk, kind /*single|squads_v3|squads_v4|spl_gov|pda_other|none*/, multisig_addr null, updated_slot)
multisigs(address pk, kind, threshold smallint, time_lock_s int, config_authority text null,
          member_count smallint, updated_slot)
multisig_members(multisig, member, permissions smallint, added_slot, removed_slot null, pk(multisig, member, added_slot))
nonces(address pk, authority, created_slot, created_sig, advanced_count int, last_advanced_slot, closed_slot null)
watched_signers(address pk, reason /*member|authority*/, protocol_id)

raw_tx(signature text, slot bigint, block_time timestamptz, commitment text, source text /*stream|backfill|poll*/,
       tx bytea /*compressed*/, status text, pk(signature))           -- partition by month
events(id bigserial, event_uid text unique /*sig:ix_path*/, slot, block_time, signature, ix_path,
       protocol_id, program_id, kind text /*upgrade|set_authority|threshold_changed|member_added|timelock_changed|
       proposal_created|proposal_executed|nonce_created|nonce_advanced|privileged_ix|unknown_privileged_ix|
       verify_status_changed|idl_changed|account_changed_undecoded|close*/,
       category, actor text[], payload jsonb, privilege_basis, decode_confidence, finalized bool, tombstoned bool)
control_state(protocol_id, slot, state jsonb /*see §7 ControlState*/, state_hash bytea, pk(protocol_id, slot))

rules(id text pk, version int, definition jsonb, enabled bool)
risk_deltas(id bigserial, delta_uid text unique /*protocol:slot:rule*/, protocol_id, event_ids bigint[], rule_id, rule_version,
            severity text /*info|low|medium|high|critical*/, score_before smallint, score_after smallint,
            explanation text, facts jsonb, status text /*active|corrected|retracted*/, correction_id null, created_at)
protocol_scores(protocol_id pk, score smallint, grade, components jsonb, as_of_slot)
corrections(id, risk_delta_id, reporter, reason, evidence_url, decision, decided_at)

positions(wallet, protocol_id, kind /*token|lp|obligation|perp|stake*/, value_usd, detail jsonb, resolved_at, pk(wallet, protocol_id, kind))
users(id uuid pk, wallet text unique null, email null, telegram_chat_id null, created_at)
subscriptions(id uuid, user_id, scope /*protocol|program|wallet_positions|firehose*/, target text, min_severity, channels text[])
webhooks(id uuid, user_id, url, secret_enc bytea, active, failure_count, created_at)
alerts(id uuid, risk_delta_id, subscription_id, created_at)
deliveries(id, alert_id, channel, status, attempts, last_error, delivered_at)
attestations(id, protocol_id, slot, kind /*sas|policy*/, state_hash, tx_sig, pda text, status, created_at)
verification_checks(program_id, checked_at, is_verified, on_chain_hash, executable_hash, commit, repo_url, raw jsonb)
replay_runs(id, incident text, from_slot, to_slot, rules_version, created_at)  replay_alerts(run_id, …same as risk_deltas)
x_posts(id, risk_delta_id, tweet_id, text, posted_at)
payments(id, route, payer, amount_atomic, network, tx_sig, facilitator, created_at)
api_keys(id, user_id, hash, tier, rate_limit_rpm, created_at)
```

Indexes: `events(protocol_id, slot desc)`, `events(kind, slot desc)`, `events(program_id, slot desc)`, `events using gin(actor)`, `risk_deltas(protocol_id, created_at desc)`, `risk_deltas(severity, created_at desc)`, `control_state(protocol_id, slot desc)`, `positions(wallet)`, `watched_signers(address)` (hash), `raw_tx(slot)`.

Retention: events, risk_deltas, control_state, program_versions, attestations: **forever** (the product is the permanent record). `raw_tx` for control events: forever (compressed, ~1 KB each). `raw_tx` for non-privileged protocol user ix: 7 days. ELFs: forever in R2. `deliveries`: 90 days.

Permalinks: `/{protocol}/e/{signature}:{ix_path}` for events and `/{protocol}/d/{delta_uid}` for deltas. Both keys derive from chain data (signature, slot, rule id) so they survive DB rebuilds and re-indexing; never expose `bigserial` ids. Corrected deltas keep the URL and show the correction banner. Tombstoned events keep the URL with "retracted: dropped fork".

---

## 5. Risk engine

### 5.1 Rule format (data, versioned, in `rules` table; source of truth is `rules/*.yaml` in repo)

```yaml
id: threshold_lowered
version: 1
on: [threshold_changed, member_removed]
when: "after.threshold < before.threshold"
severity:
  - if: "after.time_lock_s == 0 && after.threshold <= 2"   then: critical
  - if: "after.threshold / after.member_count < 0.5"       then: high
  - else: medium
score_delta: "-(before.threshold - after.threshold) * 15"
explain: "{protocol}'s admin multisig now needs {after.threshold} of {after.member_count} signatures (was {before.threshold}). Timelock: {after.time_lock_human}."
```

Expression language: `filtrex`/`expr-eval`-style sandboxed expressions over `{event, before, after, protocol, history}` (no code eval). `history` exposes windowed queries: `history.count('nonce_created', actor_in=members, days=14)`.

Initial rule set (each a file): `upgrade_unverified`, `upgrade_no_proposal` (Upgrade with no preceding proposal older than time_lock), `authority_to_single_key`, `authority_to_unknown`, `made_immutable` (positive), `threshold_lowered`, `member_added_unknown`, `timelock_reduced`, `timelock_zero_on_admin`, `nonce_created_by_signer` (Drift pre-signal; escalates to high if ≥ 2 members in 14 d), `nonce_cluster_plus_config_change` (composite: nonces then threshold/time_lock change within 30 d → critical), `proposal_created_config`, `privileged_market_create`, `privileged_oracle_change`, `privileged_limit_raise` (> 5× ⇒ high), `pause_toggled`, `verify_drift` (verified→unverified), `unknown_privileged_ix`, `account_changed_undecoded`.

### 5.2 Evaluation
State builder emits `(event, before_state, after_state)`; risk engine loads rules whose `on` includes the event kind, evaluates in memory (rules cached, reloaded on NOTIFY), writes `risk_deltas` idempotently (`delta_uid`), recomputes `protocol_scores` (base score from static control posture: key type, M/N, timelock, verification, immutability; minus active deltas decaying over 30 d). Deterministic: same events + same rule versions ⇒ same deltas (property the replay engine and tests rely on).

### 5.3 Explanations
Every delta carries `explanation` (one sentence, plain, from template) and `facts` (the numbers). The protocol card's "who can move your money" sentence is generated from `control_state` by one template function, e.g. "Any 2 of 5 keys can change Drift's markets and withdraw limits immediately; no delay."

### 5.4 False-positive correction path
- Public "this is wrong" link on every delta → `corrections` row (wallet-signed message or email; rate-limited).
- Founder reviews in an admin page (behind wallet allowlist); decisions: `confirm | correct(new_severity, note) | retract`. The delta keeps its permalink; status + note shown; downstream: webhook `delta.corrected`, X reply to the original post, attestation superseded on next batch.
- If a rule is wrong generally: bump rule version, re-run engine over history (replay-style) into a shadow table, diff, then promote. Never mutate old deltas silently.

---

## 6. Wallet position resolution

Goal: set of `protocol_id` where the wallet has value, refreshed on connect and every 6 h for subscribed wallets.

Layered approach:
1. **Token accounts** — `getTokenAccountsByOwner` for SPL Token and Token-2022. Map mints to protocols via a `mint_protocol` table: LP/receipt tokens (Kamino kTokens, Meteora LP, Raydium LP, mSOL → Marinade, JitoSOL → Jito stake pool, Sanctum LSTs → Sanctum, Drift insurance? no (account-based)). Seeded from Jupiter token list tags + protocol docs (manual for top 50 mints).
2. **NFT positions** — Orca Whirlpool and Raydium CLMM positions are NFTs; mint → position PDA → pool → protocol. Meteora DLMM positions are program accounts owned by the user: `getProgramAccounts(DLMM, memcmp owner offset)`.
3. **Program-owned user accounts (obligations/margin)** via `getProgramAccounts` with `memcmp` on the owner/authority field:
   - Drift v2: `User` accounts, authority at offset 8; also `UserStats`. Or PDA derive `[b"user", authority, sub_id u16]` for sub_id 0..n (cheaper: derive 0..7, `getMultipleAccounts`).
   - Kamino Lend: `Obligation` PDA derivation `[tag, id, owner, lending_market, seed1, seed2]` for known markets; or gPA memcmp owner.
   - marginfi v2: `MarginfiAccount` with `authority` field; gPA memcmp.
   - Solend/Save, Jupiter Perps, Jupiter Lend (**ASSUMPTION** layouts; add from IDLs).
   gPA = 10 credits on Helius ([H]); ~10 protocols × 1 call = 100 credits per wallet resolve.
4. **External aggregator (optional accelerator)** — a portfolio API (e.g. Helius DAS for tokens; Step Finance / Sonar / Jupiter Portfolio APIs) — **ASSUMPTION** availability and terms not verified this session; use only as cross-check, never sole source.
5. Output `positions` with `value_usd` (Jupiter Price API for mint prices; obligations via deposited amounts × price). Values are indicative and labelled so.

Privacy: wallet addresses are public data, but we never publish a user's wallet→protocol mapping; positions are private to the subscribing user.

---

## 7. APIs

### 7.1 Public REST (Next.js route handlers, JSON, `ApiResponse<T>`), free, cached at edge 10–30 s

```ts
type ApiResponse<T> = { data: T; error: null; as_of_slot: number } | { data: null; error: { code: string; message: string } }

type ControlState = {
  protocol: string
  programs: { program_id: string; authority: Authority; last_deploy_slot: number; elf_sha256: string;
              verified: 'verified' | 'drifted' | 'never'; verify_commit?: string }[]
  admins: { account: string; field: string; controller: Authority }[]
  who_can_move_money: string   // plain sentence
  score: number; grade: 'A'|'B'|'C'|'D'|'F'
}
type Authority =
  | { kind: 'single'; address: string }
  | { kind: 'squads_v4' | 'squads_v3'; multisig: string; vault: string; threshold: number; members: string[]; time_lock_s: number }
  | { kind: 'spl_gov'; realm: string; governance: string; min_voting_time_s: number; hold_up_s: number }
  | { kind: 'immutable' } | { kind: 'unknown'; address: string }

type RiskDelta = { uid: string; protocol: string; slot: number; block_time: string; severity: Severity;
                   rule: string; explanation: string; facts: Record<string, unknown>; events: string[]; permalink: string;
                   status: 'active'|'corrected'|'retracted' }
```

Endpoints: `GET /api/v1/protocols`, `/protocols/{id}`, `/protocols/{id}/state?slot=` (historic control state), `/protocols/{id}/events?cursor=`, `/protocols/{id}/deltas`, `/programs/{id}`, `/programs/{id}/versions`, `/feed?severity=&cursor=` (cursor = `slot:uid`), `/feed/stream` (SSE; Vercel function streams from Postgres LISTEN via a small relay on the worker — Vercel functions can't hold LISTEN connections long; **SSE served by the worker** at `stream.<domain>`), `/replay/{incident}`, `/attestations/{protocol}`, `/wallet/{addr}/positions` (auth: signed-in owner only).
GraphQL: **not built** (D5) — REST + cursor pagination covers every consumer; revisit on integrator ask.

### 7.2 Auth
- Users: Sign-In With Solana (SIWS message signed by wallet → httpOnly session cookie, JWT with 7 d expiry). Email magic link optional; Telegram linking via bot `/start <one-time-code>`.
- API keys for integrators: `Authorization: Bearer cp_live_…`, stored hashed (sha256), tiered rate limits.

### 7.3 Webhooks (outbound)
Payload: `{ id, type: 'delta.created'|'delta.corrected'|'delta.retracted'|'event.created', created_at, data }`.
Signature: `X-CP-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, t + "." + body)>` (Stripe scheme); reject replays > 5 min on the receiver side (documented). Retries: exponential 30 s → 12 h, 8 attempts; auto-disable after 24 h failing, email owner. Secrets encrypted at rest (libsodium secretbox, key in env).

### 7.4 x402 paid endpoints
Using `@x402/next` middleware + `@x402/svm` mechanism ([X]); payment in USDC on Solana mainnet; facilitator **PayAI** (Solana-native) primary, **CDP** secondary (**ASSUMPTION**: CDP facilitator supports Solana mainnet — verify day 9). Routes:
- `GET /api/x402/v1/firehose?since_slot=` — $0.01 per call, up to 500 deltas.
- `GET /api/x402/v1/protocols/{id}/state?slot=` — $0.002.
- `GET /api/x402/v1/check?program=&max_threshold_drop_days=&min_timelock_s=` — $0.001, the off-chain twin of the on-chain policy check (agents ask "is it safe to deposit?").
- `POST /api/x402/v1/webhooks` — $5 per 30-day per-program webhook.
Every paid response includes `as_of_slot` and the attestation PDA so agents can verify on-chain. Payments logged to `payments`.

### 7.5 Rate limits
Upstash Redis sliding window (or Postgres token bucket if avoiding a dependency): anon 60 req/min/IP; key free 600/min; paid key 6,000/min; x402 unlimited (payment is the limiter) but 50 req/s/payer safety cap.

### 7.6 On-chain policy program (Anchor) — interface
```rust
#[account] pub struct ControlRecord {          // PDA ["control", program_id]
  pub program: Pubkey, pub protocol_id: [u8; 32],
  pub authority_kind: u8, pub threshold: u8, pub members: u8, pub time_lock_s: u32,
  pub verified: u8, pub last_deploy_slot: u64,
  pub last_weakened_slot: u64,   // slot of last threshold drop / timelock cut / authority→single
  pub state_hash: [u8; 32], pub attested_slot: u64, pub attester: Pubkey, pub bump: u8 }
#[account] pub struct Config { pub attesters: Vec<Pubkey>, pub quorum: u8, pub admin: Pubkey }  // ["config"]

ix attest(program, record_fields, observed_slot)        // attester signer; quorum later (N sigs via multiple attest calls accumulating)
ix check(policy: Policy) -> Result<()>                   // CPI-callable; reads ControlRecord + Clock
struct Policy { max_weakened_age_slots: u64, min_timelock_s: u32, min_threshold: u8, require_verified: bool, max_staleness_slots: u64 }
// errors: ControlWeakenedRecently, TimelockTooShort, ThresholdTooLow, Unverified, AttestationStale
```
Staleness check matters: a stale record must fail closed (`AttestationStale`), else an attacker benefits from the indexer being down. Also exposes `set_return_data` with the record for callers that want to decide themselves.

SAS: one credential ("ControlPlane Indexer"), one schema `control_state_v1` {program, slot, authority_kind, threshold, members, time_lock_s, verified, state_hash}, one attestation per protocol per change (not per block). Via `sas-lib` 1.0.10 (brief). Attestation writer batches every 5 min, only finalized changes; costs ~0.002 SOL rent per attestation (**ASSUMPTION**).

---

## 8. Stack decisions

### D1: Process topology

| Criterion | A: single worker process, modules + PG queue | B: microservices + Kafka/NATS | C: all serverless (webhooks → Vercel functions) |
|---|---|---|---|
| Complexity | Low | High | Med |
| Time to build | 0.5 d | 3 d | 1 d |
| Maintainability (solo) | High | Low | Med |
| Scalability | Med (fine to ~10⁴ events/s) | High | Med |
| Reversibility | Easy (modules already isolated by table) | Hard | Med |
| Risk | one crash stops all → supervisor + per-module try/catch | ops burden eats the 16 days | no persistent stream; webhook cost on loader firehose; cold starts; no LISTEN |

**Recommendation A.** **Runner-up C** if Triton/Helius streams both fail and we fall back to Helius webhooks only.

### D2: Stream provider

| Criterion | Triton Yellowstone PAYG | Helius Developer (WSS) | Helius Business (gRPC) | QuickNode Scale | Public RPC poll |
|---|---|---|---|---|---|
| Cost/mo | ~$25 ($125 deposit) [T] | $49 [H] | $499 [H] | $499 [Q] | $0 |
| Latency | ~sub-second | ~400 ms processed | sub-second | sub-second | 10–20 s |
| Inner ix / account subs | yes | tx yes, accounts via separate WSS | yes | yes | yes (via getTransaction) |
| Replay on reconnect | from_slot (**ASSUMPTION**) | no | 48 h | ? | n/a |
| Risk | onboarding delay | WSS drops, no replay | cost | cost | 429s during demo |

**Recommendation: Triton PAYG primary + public-RPC poller always running as a cross-check** (the poller also proves no missed events: daily reconciliation job compares both). Runner-up Helius Developer.

### D3: Database

| Criterion | Postgres (Neon/Fly) | Postgres+Timescale | ClickHouse |
|---|---|---|---|
| Fit | relational state + jsonb + LISTEN + queue | adds hypertables for raw_tx | analytics only; no queue, weak updates |
| Volume | ~10⁵ control events/yr — trivial | unnecessary | unnecessary |
| Risk | none material | extension availability on Neon | two DBs |

**Recommendation Postgres 16**, monthly partitions on `raw_tx`. ORM: **Drizzle** (worker is plain Node, SQL-shaped queries, no binary). Runner-up: add ClickHouse only if the public firehose analytics become a product.

### Other choices
- Language: **TypeScript (Node 22)** everywhere off-chain (founder fluency; `@solana/kit`, `@triton-one/yellowstone-grpc` client, Codama/Anchor coders `@coral-xyz/anchor` BorshInstructionCoder). Rust only for the policy program.
- Decoding lib: Anchor `BorshInstructionCoder` + Codama renderers for Shank IDLs; hand-written layouts for loader/system/SPL Gov with `@solana/kit` codecs.
- Cache: in-process LRU for IDLs and control state; Upstash Redis only for rate limits.
- Hosting: worker on **Fly.io** (1 machine + 1 standby in another region, `fly deploy`; persistent process; health check `/healthz` = last_event_age < 120 s) ; web on **Vercel**; PG on **Neon** (branching for replay/rule-shadow runs).
- Observability: pino JSON logs → Better Stack/Axiom free tier; metrics table `health_metrics` + `/status` public page (lag in slots, events/h, last upgrade seen, decode coverage); alert the founder via the same Telegram bot when stream lag > 60 s or poller finds an event the stream missed.
- Secrets: Fly secrets + Vercel env; attester keypair and X API keys in Fly secrets only; attester key is a dedicated hot key with ≤ 1 SOL; program `Config.admin` is a Squads multisig (we eat our own dog food: our own control state is listed on the site).
- Cost ceiling: $150/mo (§2.3).

---

## 9. Testing strategy and "done"

Fixtures: `fixtures/mainnet/<sig>.json` = raw `getTransaction` JSON (+ pre/post account snapshots where needed) for real txs: a loader Upgrade by a Squads vault (CPI), a SetAuthority, a SetAuthorityChecked, Squads v4 change_threshold / set_time_lock / add_member / proposal_create / vault_transaction_execute, SPL Gov proposal execute, InitializeNonceAccount, the Drift 2026-03-23 nonce txs, Drift threshold change, Drift malicious market create, a Kamino and marginfi privileged ix. Collected by a `scripts/fixture.ts <sig>` (captures and freezes).

| Service | Tests | Done means |
|---|---|---|
| ingest | fixture replay through filter; dedup property (same tx from 3 sources → 1 row); reconnect gap test with fake stream | runs 24 h on mainnet with 0 gaps vs poller reconciliation |
| decode | golden tests: fixture → expected event JSON; IDL version selection by slot; unknown ix path | ≥ 95 % of privileged ix on top 20 protocols decoded over 7 d (coverage metric) |
| state builder | fold(backfill events) == live read for each tracked protocol (checksum test, run nightly) | 100 % checksum match or explicit `backfill_gap` rows |
| risk engine | unit per rule; **property tests** (fast-check): determinism, monotonicity (weaker state never scores higher), idempotence (re-evaluate ⇒ no new deltas), explanation templates never contain `undefined` | all rules have ≥ 1 positive and 1 negative fixture |
| verification poller | mocked OtterSec responses + live smoke on 15 programs | transitions logged for the 15 reference programs |
| alert dispatcher | webhook signature verification test vector; retry schedule; Telegram sandbox chat | end-to-end: fixture event → Telegram message < 5 s |
| attestation writer | devnet integration; idempotent re-run | mainnet SAS attestation readable with curl, no key |
| policy program | Anchor tests (bankrun/LiteSVM): attest, check pass/fail per rule, stale fails closed, non-attester rejected, CPI from a dummy vault program | deployed mainnet, verified build via OtterSec (we must be verified ourselves) |
| public API / x402 | contract tests on response shapes (zod); x402 402→200 on devnet then mainnet | a paid mainnet call succeeds via PayAI |
| replay engine | Drift replay produces the expected alert sequence (golden file); determinism | alerts with original slots, first alert ≥ 8 days before the drain |
| X bot | dry-run mode rendering; posts only finalized ≥ medium | 1 real post live |
| position resolver | per-protocol fixture wallets (known Drift/Kamino/marginfi users from public txs) | correct protocols for 10 sampled wallets |

---

## 10. Build order and critical path (16 days, 2026-09-27 → 10-12)

Critical path: **ingest → decode → state → risk → Drift replay** (this is the demo and the insight). UI (SURFACE) runs in parallel from day 4 on real API data.

| Day | Build | Exit check |
|---|---|---|
| 1 (09-27) | Repo, PG schema, Triton token, SAS program ID + Anchor IDL seed confirmed, fixture capture script, poller ingest for loader+Squads v4 | rows landing |
| 2 | Drift history pull (window 03-01..04-03), validate archive availability | Drift raw_tx complete |
| 3 | Decoder: loader, system nonce, Squads v4 (IDL), Anchor generic + IDL fetch (PM + legacy) | golden tests pass |
| 4 | Yellowstone stream + dedup + finalizer; protocol registry seed (top 50 by TVL, programs, admin accounts) | 24 h run starts |
| 5 | State builder + backfill fold + checksum | top 20 protocols checksum OK |
| 6 | Risk engine + rules + explanations | property tests pass |
| 7 | **Replay engine + Drift golden** | Drift alert timeline correct |
| 8 | Verification poller; program_versions + ELF to R2; privileged classification + categories | 15 reference programs states |
| 9 | Public REST + SSE; x402 routes on devnet | API contract tests |
| 10 | Alert dispatcher: Telegram, webhooks (signed), email (Resend) ; SIWS auth, subscriptions | e2e alert < 5 s |
| 11 | Policy program (Anchor): attest/check + tests; devnet | tests green |
| 12 | Attestation writer (SAS + policy) mainnet; program mainnet deploy + verified build | mainnet reads |
| 13 | Position resolver (tokens, CLMM NFTs, Drift/Kamino/marginfi); position-aware alerts | 10 wallets correct |
| 14 | X bot live; SPL Gov + Squads v3 decoders; protocol registry to 150 | first post |
| 15 | Hardening: reconciliation job, status page, rate limits, x402 mainnet | 48 h clean run |
| 16 (10-12) | Freeze, demo, counts snapshot | submit |

Risks that could sink each service:

| Service | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| ingest | Triton onboarding slow / filter size limit on 1.5k signers | Med | High | poller from day 1; Helius Developer fallback; split signer filters across 2 streams |
| backfill / Drift | archive gaps or pruned txs for March 2026 | Low-Med | **Critical** (replay is the demo) | day-2 validation; two providers; if gaps, show them honestly |
| decode | Drift's historical IDL differs from current; privileged ix mis-classified | Med | High | IDL version from IDL-account history; runtime signer match as authoritative |
| decode | Program Metadata compression/format misunderstood | Med | Med | read client source day 3; legacy Anchor path in parallel |
| state builder | protocols whose admin is a PDA of another program (e.g. governance-controlled config) not modelled | High | Med | `authority.kind='pda_other'` + "unknown" honest label; hand-map top 20 |
| risk engine | noisy alerts (every proposal) annoy users / X followers | Med | Med | severity floors per channel; X only ≥ medium & finalized; correction path |
| verification | OtterSec API rate limits / downtime | Med | Low | 10 min cadence, cache, backoff; PDA read as fallback |
| alert dispatcher | Telegram/email deliverability | Low | Med | Resend verified domain; delivery log |
| attestation | SAS not live on mainnet / lib breaking | Low-Med | Med | policy program is independent of SAS; SAS devnet fallback labelled |
| policy program | first Anchor program; security bug in `check` | Med | High | tiny surface; fail-closed on staleness; LiteSVM tests; no funds held |
| x402 | facilitator Solana mainnet support changes | Med | Low | PayAI primary, CDP secondary, devnet demo fallback |
| positions | layouts wrong for obligations | Med | Med | PDA derivation first, gPA second; top 3 protocols only guaranteed |
| X bot | X API tier cost/limits for posting (**ASSUMPTION**, not verified) | Med | Low | manual posting from generated text as fallback |
| whole | solo bandwidth — 12 services in 16 days | High | High | agents implement per service against this doc; strict order above; UI parallel |

---

## Implementation notes
- Protocol registry (protocols → programs → admin accounts → multisigs) is **hand-curated for the top 50** and the single biggest manual cost; start day 1 from DefiLlama Solana TVL list (**ASSUMPTION** API free) + program IDs from each protocol's docs. Everything else is automatic.
- Squads vault ↔ multisig mapping: an authority address is a Squads v4 vault if some multisig derives it; resolve by reading the authority's recent txs for `vault_transaction_execute` and taking the multisig account from it (cheaper than brute derivation).
- Store every `Upgrade`'s ELF from day 1, even untracked programs (it's cheap and it is the archive nobody else keeps).
- Our own policy program's upgrade authority is a Squads multisig with a timelock, listed on our site with its own score.

## Summary
The backend is one TypeScript worker on Fly.io (ingest, decode, state builder, risk engine, verification poller, alert dispatcher, attestation writer, replay engine, X bot, position resolver as isolated modules over a Postgres event log and job queue), a Next.js API on Vercel (public REST + SSE, signed webhooks, x402 routes through `@x402/next` + `@x402/svm` with PayAI/CDP), and a small Anchor policy program whose `check` instruction fails closed on weakened or stale control records. Ingest is a Triton Yellowstone stream filtered by program ID and watched signer keys, with in-process filtering by loader discriminants (2–7, dropping the >98 % `Write` traffic), Squads v4/v3, SPL Governance, System-program nonce instructions, and IDL-classified privileged admin instructions. A public-RPC poller reconciles gaps. Control state is a fold over an append-only event log, checked against live account reads, so the state at any slot can be reconstructed. The Drift March–April 2026 timeline is rebuilt the same way and replayed through the real rules. Running cost is about $25–$150 a month, against $499 for gRPC tiers at Helius Business or QuickNode Scale. The critical path is ingest → decode → state → risk → Drift replay by day 7. The two biggest risks are archive completeness for March 2026 and solo bandwidth across twelve services. Status: designed only; ASSUMPTION marks every fact not confirmed this session (SAS program ID, Squads v3 ID, exact x402 npm names, Triton filter limits, CDP Solana support, X API limits).
