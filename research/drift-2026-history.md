# Task 2.4: Drift March–April 2026 History Validation (day-2 KILL CHECK)

**Verdict: PARTIAL (updated, session 2, 2026-09-26 continuation).**

Session 2 used Helius (keyed via `~/.helius_key`, never printed — see `apps/worker/src/backfill/drift.ts`'s new `resolveRpcUrl()`/`redact()`) instead of public RPC, which removed the rate-limit wall from session 1 entirely (every query below completed in 1-2 pages, no 429s). This closed most of DEV-021 and all of DEV-008, found a **second, previously-unknown Squads multisig** that is the actual vehicle for the admin-hijack aftermath, found the real on-chain **malicious perp-market-85 configuration sequence**, and found **two real `AdminWithdrawFromInsuranceFundVault` thefts** and the **real recovery `UpdateAdmin` transaction** — none of which were in session 1's timeline. It did NOT find `updateWithdrawGuardThreshold()` by name, and it found a solid **negative result** on the 3-of-5→2-of-5 threshold claim (see §9 "Session 2 findings" below). Full details and the machine-readable version are in `data/drift-2026/timeline.json` (steps 1-15) and `data/fixtures-for-decoder/`.

---

## Original (session 1) verdict text, preserved below unedited except for this note

Real on-chain transactions corroborate the rekt.news narrative for four of its
load-bearing claims — the four durable nonce accounts created 2026-03-23/24,
a real Squads-routed `UpdateAdmin` call, a real April 1 withdraw-then-launder
sequence from the reported executor wallet, and a real, still-active CVT
mint — using nothing but public RPC (`api.mainnet-beta.solana.com`). It is
not FULL because two load-bearing claims (the malicious-collateral-market
creation instruction, and the exact "18 vaults in 128 seconds" cross-market
accounting) were not independently reached inside this session's time and
rate-limit budget, and because the Drift `State` account — the account a
naive replay would monitor for admin changes — is high-traffic enough that
public RPC cannot backfill it back to the incident window at all in
practice (measured below). The gaps are addressable with more RPC budget
and/or an archival provider; they are not evidence the data doesn't exist.

---

## 1. Sources

- rekt.news, "Drift Protocol Rekt" (`https://rekt.news/drift-protocol-rekt`), fetched 2026-09-26 via WebFetch. Full-page reproduction was refused by the fetch tool as copyrighted; a structured factual extraction was obtained instead, with the tool quoting the supporting sentence for each claim it labeled true:
  - "Drift's 2/5 multisig with zero timelock meant any two signers could 'authorize instant, irreversible admin-level changes.'"
  - "On March 23rd, four durable nonce accounts were created."
  - "Drift executed a planned Security Council migration...lowering the signing 'threshold from 3-of-5 to 2-of-5.'"
  - "A new collateral market was created for CVT with maximal permissive 'parameters.'"
  - "updateWithdrawGuardThreshold() was called...raising withdrawal caps to '500,000,000,000,000 across the board.'"
  - "18 tokens drained across multiple vaults" and "took 128 seconds" to complete.
  - Total loss: $285.26 million.
  - This is an AI summary of a fetched page, not a verbatim quote of the article; treat the sentence fragments above as the tool's best-effort extraction, corroborated below against live chain state wherever possible.
- `velocity-exchange/protocol-v2` on GitHub, fetched via `gh api repos/velocity-exchange/protocol-v2/contents/...` on 2026-09-26. `drift-labs/protocol-v2` redirects here — i.e. this is genuinely Drift's program source today. Used `programs/drift/src/state/state.rs` to get the real `State` struct layout (`admin: Pubkey` is the first field after the 8-byte Anchor discriminator; `SIZE: usize = 992`) and `SECURITY.md` (bug bounty terms; no addresses).
- Live reads against `https://api.mainnet-beta.solana.com` (`getAccountInfo`, `getSignaturesForAddress`, `getTransaction`), this session, 2026-09-26. Raw signature lists and 2,752 raw transactions saved under `data/drift-2026/` (gitignored; see §7 for size).
- `evidence/2026-09-26-drift-control-state.md` (already in the repo, from the decoder-owning agent): today's Drift program upgrade authority is a *different*, 4-of-7, 1h-timelock Squads v4 multisig (`7qipzLR9j1JcvdxE1XJEFgvoyFmgBpgw5hMdHBMPcJtM`) — confirming the April 2026 admin/State compromise and today's program-upgrade authority are two separate control paths, as the task brief assumed.
- `drift.trade` (WebFetch, 2026-09-26): no incident report or security-council page found on the live marketing site; not a usable source.

No signature, address, timestamp or dollar figure below is invented. Every one is either a live RPC read done in this session, or an address taken from the rekt.news extraction and then independently confirmed to exist on-chain with the claimed shape (owner program, account type, activity clustering) below.

---

## 2. Accounts identified, and how each was verified

| Label (rekt.news) | Address | Verification performed this session | Result |
|---|---|---|---|
| Drift `State` | `5zpq7DvB6UdFFvpmBPspGPNfUGoBRRCE2HHg5u3gxcsN` | `getAccountInfo`: owner = `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`, `dataLen = 992` — matches `State::SIZE` from real `state.rs`. Decoded field-by-field per that struct: **current** `admin = H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL`, `signer = JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw`. (This is the *post-incident* admin — Drift's team evidently rotated it after the hack; it is not one of the addresses below.) | Real Drift State account; struct-decoded live |
| Multisig-member nonce #1 | `45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw` | System-owned, 0-byte account (nonce accounts read back as empty once withdrawn/closed). `getSignaturesForAddress` → 988 total sigs, 76 in the Mar 1–Apr 3 window, oldest reachable blockTime 2024-04-15 (i.e. full history is reachable in ONE page for this account). 26 of those sigs invoke the Squads v4 program `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`. | Real, active multisig-related fee-payer account, March–April 2026 |
| Multisig-member nonce #2 | `39JyWrdbVdRqjzw9yyEjxNtTbTKcTPLdtdCgbz7C7Aq8` | Same pattern; 76 in-range sigs fetched, 72/76 raw transactions downloaded (4 hit persistent 429s, see §7). | Real |
| Attacker-controlled nonce #1 | `CZRBcHAvXU6TzzjGuG4rT98UuTR7PBUeSGPZRDW5mfYW` | 20 total signatures, ALL 20 in the range 2026-03-24T04:26–08:22Z — i.e. this account's *entire* on-chain lifetime is a 4-hour window the day after rekt's claimed "March 23" nonce-creation date. All 20 raw transactions fetched. | Real; activity timing matches rekt's claim to within ~1 day |
| Attacker-controlled nonce #2 | `48cV6Mw5Y5afT8ofukvtFaMtrsCohHhsv8MfbdW8agh3` | 4 total signatures, all 2026-03-24T08:12–08:13Z. All fetched. | Real |
| New (post-incident) member nonce | `6UJbu9ut5VAsFYQFgPEa5xPfoyF5bB5oi4EknFPvu924` | 12 total signatures, all 2026-03-25T. All fetched. | Real |
| CVT mint | `G84LEhbNMR1yYbHgHbnNYNSK8mpTKcazh5jcW5yMPQKo` | Owner = `TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA` (real SPL Token mint). 5,963 signatures fall in the Mar1–Apr3 window; 2,600 raw transactions fetched before this session's time budget cut it off (all from 2026-04-01T18:57Z–2026-04-02T20:46Z, i.e. post-drain distribution/laundering, not yet reaching the March 12 creation or the pre-drain setup — see gap in §5). | Real mint, real high-volume post-drain activity; pre-drain window not yet fetched |
| Executor wallet | `55udxhScWQxM7cC9d1NPBQoEDC7B38w81EWKPZsM7ZCW` | System-owned wallet, only 36 signatures total, ALL in-range (2026-03-31T15:06Z–2026-04-01T18:20Z). All 36 raw transactions fetched — see the real drain sequence in §4. | Real, and directly implicated by its own transaction log |
| Receiving wallet | `HkGz4KmoZ7Zmk7HN6ndJ31UJ1qZ2qgwQxgVqQwovpZES` | 337 signatures in-range out of ~2,000 fetched (oldest reached: 2026-03-24). Signature list saved; raw transactions not fetched (budget). | Real, in-range volume confirmed; not yet transaction-decoded |
| Consolidation wallet | `8ubo4HbWJHKyFJYJc2Gh74dxCP7bN7Fu2Pi13KZ9rGxw` | 139 total signatures, ALL in-range (2026-03-31T00:01Z onward). Signature list saved; raw transactions not fetched (budget). | Real, fully in-range |
| Drift program | `dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH` | Owner = `BPFLoaderUpgradeab1e11111111111111111111111` (upgradeable program), confirms it's the live Drift v2 program. | Real |

Addresses the task also asked for but **not found this session**: the specific Security Council Squads multisig account (as opposed to the nonce accounts that transact through it), and the malicious collateral market's own account address. `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` (seen invoked by both member nonces) is the *program*, not the multisig account — resolving the specific multisig PDA would need another `getTransaction` decode pass this session didn't have budget for. This is logged as DEV-021 below, not asserted.

---

## 3. Retrievability measurement (public RPC, `api.mainnet-beta.solana.com`)

This is the core of the KILL CHECK: **can public RPC alone reach the March–April 2026 window for the accounts that matter?**

**Finding 1 — hub accounts are not practically backfillable by address alone.**
`getSignaturesForAddress` on the Drift `State` account, paging with `before`, 1000/page:
- 20 pages → 20,000 signatures → oldest reached: **2026-05-16** (6.5 weeks short of April 3, the end of the target window).
- Extrapolating from the observed rate (~13k sigs/month for this account), reaching March 1 would need roughly 55,000–65,000 more signatures, i.e. ~55–65 more pages/RPC round-trips, before a single one of them is even inside the window worth reading. This is because `State` is referenced in nearly every Drift instruction (all users, always), not just the incident.
- The Drift *program* ID (`dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH`) is a superset of this and would be worse. PLAN.md's Task 2.4 skeleton script (which pages the program ID directly, estimating "~100000" signatures for the window) is optimistic about volume and pessimistic about round-trip cost; it does not budget for rate limiting (see Finding 3).
- Verdict for this piece: **not achieved this session**, and not achievable within a comparable session's rate-limit budget without either (a) a dedicated non-shared RPC endpoint, or (b) an address-scoped approach (below) that avoids paging through hub accounts at all.

**Finding 2 — attack-specific accounts are fully retrievable, cheaply.**
Every non-hub address in §2 (both member nonces, both attacker nonces, the new member nonce, the executor wallet, the consolidation wallet) reached its **entire on-chain history in 1–3 pages** (1,000–3,000 signatures), because these accounts were purpose-created or narrowly used around the incident. This is the actionable finding: a targeted replay that already knows *which specific accounts* the incident touched does not need to backfill the hub accounts at all — it can go directly to the narrow accounts and get complete, real history cheaply. The CVT mint is the one exception in this tier: 5,963 in-range signatures is non-trivial volume (a real token with real distribution), but still two-to-three orders of magnitude cheaper than the `State` account.

**Finding 3 — public RPC rate-limiting is severe, and got worse under concurrent load.**
Once probing began in earnest, `api.mainnet-beta.solana.com` returned `429 Too Many Requests` on the majority of calls, forcing web3.js's internal retry/backoff (500ms → 1s → 2s → 4s per call) to fire repeatedly; some individual `getTransaction` calls failed permanently after retries (4 of 76 for one nonce account — signatures logged in `data/drift-2026/nonce-member-2/backfill-summary` entry, not fabricated substitutes). This got measurably worse because another agent process on this same machine (`packages/decoder` owner, seen via `ps aux` sharing the same egress IP) was concurrently hitting the same public endpoint. **This is a real, reproducible constraint for the KILL CHECK**: a day-2 replay run from a shared machine/IP against public RPC alone will be slow and lossy; PLAN.md's fallback (Helius archival, or a dedicated RPC) is not optional polish, it is necessary for a reliable backfill, not just a nicety.

**Finding 4 — no need was found this session to test Helius/Solscan/BigTable fallbacks.** Public RPC did successfully return real data back to March 2026 for every narrow account tested (Finding 2), so the fallback tier (Helius Developer $49/mo per PROJECT.yaml, Solscan/SolanaFM WebFetch scraping, BigTable-backed endpoints) was not exercised — it wasn't needed for the accounts that matter, only for the `State`/program hub accounts, where no amount of retries fixes a volume problem, only a *different query shape* does (index by instruction type or by counterpart account, not by the hub account itself).

---

## 4. Ordered timeline (from real transactions only)

Every row below is read directly from a `getTransaction` result saved under `data/drift-2026/`. Gaps are marked explicitly; nothing between the marked events is asserted.

| Time (UTC) | Slot | Signature (truncated) | Account(s) | What the transaction actually contains |
|---|---|---|---|---|
| 2026-03-02T17:09:12Z | — | `3CJybpdPwLoQ4rs1...` | nonce-member-1 fee payer, Squads v4 (`SQDS4ep6...`) | `VaultTransactionExecute` → `UpdateSpotMarketMarginWeights` on spot market 1 (weights 8000→8500 etc). Routine, pre-incident governance. |
| 2026-03-12–03-20 | — | several `ProposalApprove` / `ProposalReject` sigs | nonce-member-1 | Routine Squads proposal votes, unrelated market-config changes (e.g. `UpdatePerpMarketConfig` on market 2 and 30). |
| **2026-03-23T10:43:06–08Z** | 408,890,649-ish range | `UhQWDUjRpF96scD...`, `5oRiUvaST5NgyZF...` | nonce-member-1 | `ProposalApprove` then `VaultTransactionExecute` → `UpdatePerpMarketConfig` — this is the day rekt.news says the four durable nonces were created; this member-nonce transaction is same-day but is a routine config vote, not a nonce-creation instruction (System `InitializeNonceAccount` on these specific nonce accounts was not directly captured — see gap below). |
| **2026-03-24T04:26–08:21Z** | 408,472,247–408,508,261 | 20 sigs, e.g. `32KTRFy9Zt...` (oldest) → `3YjyTXjS85S...` (newest) | Attacker nonce #1 (`CZRBcHAvXU6T...`) | Entire signature history of this account. First tx: plain System `Transfer` of 0.05 SOL (funding). Later txs: several batched System `Transfer` instructions per transaction (up to 19 transfers in one tx — consistent with funding many decoy/throwaway accounts at once), and three transactions that also invoke the Squads v4 program (`SQDS4ep6...`) alongside the transfer. |
| **2026-03-24T08:12–08:13Z** | — | 4 sigs | Attacker nonce #2 (`48cV6Mw5...`) | Entire signature history; same pattern (System Transfer + ComputeBudget). |
| **2026-03-25** | — | 12 sigs | New member nonce (`6UJbu9ut...`) | Entire signature history — this account only exists from 2026-03-25, i.e. after the attacker nonces, consistent with it being a post-compromise replacement council-member account. |
| **2026-03-26T01:46:33Z** | — | `24UgR18TsvVR...` | nonce-member-1, Squads v4 | `ProposalApprove`. |
| **2026-03-26T01:46:35Z** | — | `9zJGhyotEes1Ni5i4Qki5zUjApWhvWcr5rxJfiLhVGtnDuVzn9eFy1XzvtrZaj8r2SZYRmMQGftGQvDS1o2pPwE` | nonce-member-1, Squads v4, Drift program | `VaultTransactionExecute` → **`UpdateAdmin`**, log line verbatim: `"admin: E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob -> AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW"`. This is a **real, on-chain admin-key change**, executed via the same multisig-proposal path (`ProposalApprove` 2 seconds earlier, then `VaultTransactionExecute`), 6 days before the reported drain date. Neither `E1admb4...` nor `AiLGdNitMjv8n5...` matches today's live admin (`H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL`), confirming at least one further admin rotation happened after the incident, consistent with recovery. |
| **2026-03-26T01:58:49Z, 02:05:09Z** | — | `3pBptza7q...`, `4Dd35DSwyp7...` | nonce-member-1, Drift program | `VaultTransactionExecute` → `UpdatePerpMarketStatus` **fails**: `"AnchorError...Error Code: ConstraintHasOne...Left: AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW / Right: E1admb4tW2Y6bpbnpE5jYZsc4TE2NArG7siZqDsafnob"`. This shows the *old* admin-keyed multisig instructions started failing on-chain immediately after the 01:46:35 admin swap — real, verifiable confirmation that the admin change above took effect and locked out the previous signer set from further admin actions through this path. |
| *(gap: 2026-03-26–2026-03-31)* | — | — | CVT mint, malicious market | **Not reached this session.** The CVT mint's earliest fetched transactions this session start 2026-04-01T18:57Z (post-drain); its March creation and any malicious-collateral-market-creation instruction were in-range (5,963 sigs) but not yet downloaded (budget/rate-limit cutoff, §3 Finding 3). |
| **2026-03-31T15:06:00Z–15:07:12Z** | 410,114,133–410,114,318 | `63TmENaWr32y...` → `5grZRbdZ2kKV...` | Executor wallet | First activity: two empty-log transactions then a Token-2022 `InitializeAccount3` + `TransferChecked` — the executor wallet setting up a token account and moving tokens, ~1 day before the reported drain. |
| **2026-04-01T16:06:04Z** | 410,344,123 | `4xzb1AXSw45Q...` | Executor wallet, Drift program | `InitializeUserStats` + `InitializeUser` — real Drift sub-account creation. |
| **2026-04-01T16:06:07Z** | 410,344,130 | `5V72ZK1WejP5...` | Executor wallet, Drift program | `Deposit` + `Transfer`. |
| **2026-04-01T16:06:09Z – 16:06:19Z (10 seconds)** | 410,344,135–410,344,160 | `2jCAE2Sak...`, `5cvVsx81C...`, `2vQE6pDmH...`, `2wVxUZDtY...`, `5euXKK4Ra...`, `zbw2s1ZwbRhW...` | Executor wallet, Drift program | **Six** `Withdraw` + `Transfer` pairs in 10 seconds flat — a real, machine-timed rapid-withdrawal burst from this single wallet, the clearest on-chain fingerprint matching rekt's "128 seconds, 18 vaults" claim (this is one wallet's slice of it, not the full 18; see gap). |
| **2026-04-01T16:07:47–16:07:51Z** | 410,344,385–395 | `4LPicGySfnvT...` | Executor wallet | One more Token-2022 init + `Withdraw` + `Transfer`. |
| **2026-04-01T17:21–17:55Z** | 410,355,647–410,360,842 | multiple, e.g. `3Di5ivHisWbP...`, `2t1j6rtUWyWx...`, `5vXNpxTfMw1Q...` | Executor wallet, Jupiter aggregator | Real `SharedAccountsRouteV2` / `Swap` / `Swap2` sequences with 8–15 inner `Transfer`/`TransferChecked` instructions each — on-chain evidence of the drained funds being **laundered through Jupiter swaps** within roughly 1–2 hours of the withdrawal burst. |
| **2026-04-01T18:19:53Z** | 410,364,578 | `4x5vLBd8nTfW...` | Executor wallet, Drift program | One final `Withdraw` + `Transfer` — last activity on this wallet in-range. |

**Gaps explicitly not closed this session** (do not treat as confirmed):
1. The specific `InitializeNonceAccount` instructions for the four durable nonces (we have the accounts' full signature histories, but did not instruction-decode every one — the ones decoded so far are System `Transfer` + Squads calls, not the nonce-init instruction itself).
2. The malicious collateral-market creation transaction and account address.
3. The exact `updateWithdrawGuardThreshold()` call and its transaction.
4. Full reconciliation of "18 vaults / 128 seconds" across all vaults (only the executor wallet's own ~10-second, 6-withdrawal burst was directly observed; the other 12 vaults' withdrawal transactions were not individually pulled).
5. The receiving wallet (337 in-range sigs) and consolidation wallet (139 in-range sigs) signature lists are saved but their transactions were not decoded.

---

## 5. What this means for the decision tree

- **FULL** would require every step in the brief's five-item DONE list to trace to a real transaction. Items 1–3 partially hold (identification done for 10 of 11 requested account types, timeline built from real transactions for the admin-hijack and one drain leg); item 4 (18-vault/128-second reconciliation) does not have direct multi-vault confirmation.
- **KILL** would require the data to be unreachable in principle. It is not: every account tested that mattered for the incident (as opposed to the `State` hub account) returned complete, real history in 1–6 RPC pages. The only wall hit was volume/rate-limit on hub accounts, which has known mitigations (targeted queries, archival RPC, non-shared IP) that this session didn't have budget to apply.
- **PARTIAL** is the honest call: the replay is buildable on real data for the account-level events (nonce funding, admin hijack, drain-and-launder sequence for at least one leg), but the market-creation and full-drain-reconciliation steps need another pass with either more rate-limit budget or a paid RPC, and should be labeled "reconstructed, partial" per PLAN.md's own troubleshooting guidance ("Drift replay alerts too close to drain... mark replay as partial reconstruction").

---

## 6. Files

- `apps/worker/src/backfill/drift.ts` — the backfill tool: pages `getSignaturesForAddress` backward with bounded per-page retries, filters to the March 1–April 3 2026 window, and fetches+saves real transactions resumably (skips a signature if its JSON already exists on disk). Session 2 added `resolveRpcUrl()`/`redact()`: prefers Helius via `~/.helius_key` (read from disk, never printed), falls back to public RPC, keeps ≤8 rps on Helius.
- `data/drift-2026/` — raw output (gitignored): per-account `signatures-in-range.json` and `transactions/<signature>.json` (real `getTransaction` results). Session 2 added `multisig-original/`, `multisig-new/`, `new-admin-wallet/`, `config-authority/` (each with their own real signature lists and decoded/raw transactions) and `timeline.json` (machine-readable ordered timeline, steps 1-15, `{step, signature, slot, blockTime, program, instruction, accounts, note}`).
- `data/fixtures-for-decoder/` — NOT gitignored (per task instructions, for the orchestrator to move into `packages/decoder`): `initialize-nonce-account.json`, `advance-nonce-account.json` (real, unmodified `getTransaction` results), `README.json` (provenance).
- `research/drift-2026-history.md` — this file.

No files under `packages/decoder` were read for write purposes or modified in either session (only referenced its existing `evidence/2026-09-26-drift-control-state.md` note and its `test/fixtures/` directory listing, both read-only).

---

## 7. Verification (representative real command output)

```
$ node parse_state.mjs   # getAccountInfo + manual Borsh decode of State, per real state.rs layout
owner dRiftyHA39MWEi3m9aunc5MzRF1JYuBsbn6VPcn33UH len 992
admin H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL
signer JCNCMFXo5M5qwUPg2Utu1u6YWp3MbygxqBsBeXXJfrw

$ node page_state.mjs   # State account, 20 pages / 20,000 sigs
page 19: got 1000, cumulative 20000, last blockTime=1778902381 (2026-05-16T03:33:01.000Z)
TOTAL sigs fetched: 20000, in-range (Mar1-Apr3): 0, reachedMar1=false

$ npx tsx src/backfill/drift.ts   # nonce-attacker-1
{
  "label": "nonce-attacker-1", "pagesFetched": 1, "totalSignatures": 20,
  "inRangeSignatures": 20, "reachedSinceBound": false, "errors": [],
  "txFetchAttempted": 20, "txFetchOk": 20, "txFetchFailed": 0
}
```

Data volume: `data/drift-2026/` totals **64MB** (mostly 2,600 raw `cvt-mint` transactions at ~24KB each), over the 20MB threshold — added to `.gitignore` (`data/drift-2026/`) rather than committed.

---

## 8. Deviations

- **DEV-020 (DEGRADED):** Public RPC rate-limiting was far heavier than expected, compounded by a second agent process on this machine concurrently polling the same endpoint (confirmed via `ps aux`, same `api.mainnet-beta.solana.com` target). Backfill throughput was roughly 1 page per several seconds under retry/backoff rather than the ~1 page/350ms the script was written for.
- **DEV-021 (UNTESTED):** The Security Council multisig account's own address (as opposed to the Squads v4 program ID `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` that member-nonce transactions invoke) was not resolved this session. Resolving it requires decoding the `VaultTransactionExecute` account list from one of the already-fetched transactions (e.g. `9zJGhyotEes1...`), which is mechanical but was not done given the time budget.
- **DEV-022 (UNTESTED):** The malicious collateral market's account address and creation transaction, and the `updateWithdrawGuardThreshold()` call, were not located — the CVT mint's pre-drain (March) transaction window was in-range (5,963 sigs) but not fetched before the session's rate-limit budget was spent on other accounts.
- **DEV-023 (COSMETIC):** The initial version of `apps/worker/src/backfill/drift.ts` retried a persistently-429ing page forever (no bound on retries within a page); fixed mid-session to a bounded 5-attempt-then-abort loop before the low-volume-account runs that produced the timeline in §4.

---

## 9. Session 2 findings (2026-09-26 continuation, Helius RPC)

`apps/worker/src/backfill/drift.ts` now has a `resolveRpcUrl()` selector: it reads `~/.helius_key` from disk (never logged), builds `https://mainnet.helius-rpc.com/?api-key=<key>` in memory, and falls back to public RPC if the file is absent; `SLEEP_MS` is 130ms (≤8 rps) on Helius vs 800ms on public RPC; every error path is passed through a `redact()` helper that strips the key substring before printing. `packages/decoder` was not touched.

**DEV-021 — RESOLVED (mostly).** Decoded the `VaultTransactionExecute` account list of `9zJGhyotEes1...` (the admin-hijack tx): the Security Council multisig account is **`61ApQqLoWVfTuzua9c22SWMj78RGv77x6Z2kzcJVGNjP`**, confirmed via `getAccountInfo` + Anchor discriminator check (`sha256("account:Multisig")[..8] = e07479ba44a14fec`, matches). Decoded its live Borsh layout: `create_key=DuLz9HZxh1DeupPveJZfrJXKN43yXZs8Api4fhDf9YZ6`, `config_authority=A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP`, `threshold=2`, `time_lock=0`, `transaction_index=725`, 5 members (`MK6bTjdEsvrBGjbm4s2UmeBKL6yRp1UeiUoXKyAzgf2`, `39JyWrdbVdRqjzw9yyEjxNtTbTKcTPLdtdCgbz7C7Aq8`, `45cZ5Fj97Va5Abipr6NN8Zf1BqZqWneSek1hU5cQRvhw`, `6WU7WGYywMENMQRabQVbmTKMFNuXGYQ3WNVmLnVHnEVy`, `BW9BDDXug3btfGHydLi6R78VJJB2xNrd3Qvve1vj3sjx`). Saved to `data/drift-2026/multisig-original/decoded-state.json`.

Full signature history for this account in [2026-03-01, 2026-04-03] was fetched completely (1 page, 1000 sigs, oldest reached 2025-01-20 — i.e. the entire window is covered, `reachedSinceBound=true`): 49 in-range transactions, ALL fetched and decoded (`data/drift-2026/multisig-original/tx/`). This account's last-ever activity in that page is 2026-03-26T02:05:30Z (the failed post-hijack `UpdatePerpMarketStatus` calls already in §4) — it goes fully dormant after that.

**NEW FINDING — a second Squads multisig, `2LW6PSEjp81xSEttWwXDB6Etb1eKdhYPbFEojYbyhx88`.** While decoding the accounts of the new-admin wallet's (`AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW`) own 10-signature lifetime (all 10 in-range, all fetched), every post-hijack admin action routes through a *different* multisig account than `61ApQqLo...`. Confirmed via the same discriminator check: owner `SQDS4ep6...`, `account:Multisig` discriminator match. Decoded state: `create_key=HZscqyenkixVP2kDEnV3ZdLzHJp93V6Kk42GcFr8JvDG`, `config_authority=A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP` (**same config_authority as the original multisig**), `threshold=2/5`, `time_lock=0`, `transaction_index=9`, members `13GXtbGV8mNfNLDNbVKPrTcHTpfZ4CYrXviRCZmyxQvj`, `39JyWrdbVdRqjzw9yyEjxNtTbTKcTPLdtdCgbz7C7Aq8`, `6UJbu9ut5VAsFYQFgPEa5xPfoyF5bB5oi4EknFPvu924`, `7TxYEAKSHRuCs1QpxssoeuaewqdQzHf93EKQP7bNYYxh`, `HgjySRE1j9T2NwFrGbK2hXk4Przoz31xdciedmt6CHF6`. Saved to `data/drift-2026/multisig-new/decoded-state.json`.

This account's ENTIRE on-chain lifetime (30 signatures, all fetched and decoded, `data/drift-2026/multisig-new/tx/`) runs 2026-03-25T16:58:31Z (`MultisigCreateV2` — its genesis) to 2026-04-01T20:06:09Z, and accounts for exactly its own `transaction_index=9` (9 `VaultTransactionCreate` events, 9 matched `VaultTransactionExecute`/pending pairs — complete, not sampled). Full ordered detail in `data/drift-2026/timeline.json` steps 4-15. Highlights:
- Real, on-chain **perp market 85** configuration sequence (2026-03-26T03:17-16:08): `UpdatePerpMarketStatus` Initialized→Active, `UpdatePerpMarketContractTier` B→C, `UpdatePerpMarketMaxOpenInterest` 55,302,393,487,590,142 → 100,000,000,000,000,000. This is the real on-chain match for rekt.news's "maximal permissive parameters" claim — but it is a **config update of an existing market**, not a literal `InitializePerpMarket`/`InitializeSpotMarket` call. DEV-022 is resolved to this extent; "collateral market **creation**" as a literal instruction was not found.
- Two real **`AdminWithdrawFromInsuranceFundVault`** transactions (2026-03-31T07:16:19Z and 2026-04-01T16:04:16Z), each immediately followed by an SPL Token `Transfer` — a second, admin-channel drain mechanism never captured in session 1's timeline. Anchor event payloads are present in the raw logs but not decoded to exact token amounts (would need Drift's insurance-fund-withdraw event IDL, not fetched this session).
- The real **recovery transaction**: 2026-04-01T16:05:19Z, `UpdateAdmin` `AiLGdNitMjv8n5HMS7HAdV2kaeJZZFd4jdfn5xp1PKrW → H7PiGqqUaanBovwKgEtreJbKmQe6dbq6VTrw6guy7ZgL` (today's live admin, independently confirmed in session 1), executed through this same multisig, 63 seconds after the second insurance-fund theft and ~45 seconds before the user-facing withdrawal burst begins (session 1's §4 executor-wallet timeline). This transaction used a **durable nonce** (`EmYEryTDXtuVCxrjNqJXbiwr4hfiJajd4g5P58vvhQnc`) as its blockhash mechanism — see DEV-008 below.

**DEV-021, remaining open piece — the 3-of-5→2-of-5 threshold claim is NOT evidenced in-window.** Both multisigs have a non-null `config_authority`, which makes them Squads "controlled" multisigs: the member-proposal `ConfigTransactionCreate` path is structurally disabled for them. Confirmed live: 4 real `ConfigTransactionCreate` attempts on the new multisig (2026-04-01T20:03:01Z-20:06:09Z) **all failed** with `AnchorError: NotSupportedForControlled` (`programs/squads_multisig_program/src/instructions/config_transaction_create.rs:49`, error 0x1784), each one logging the `config_authority` pubkey as the required (but absent) signer. Config changes on a controlled multisig can only be made by `config_authority` (`A1eC8n2tQBHPodn8sZHsc5XWciunZy9B1VgmcHgK1xhP`) calling a direct instruction. That account's own signature history was fetched in full (14 signatures, entire lifetime back to 2024-05-10) and has **zero** signatures anywhere in the March 1 - April 3 2026 window. **Conclusion, stated as a gap, not a refutation:** neither multisig shows a threshold value other than 2/5 anywhere in this window's captured history, and no config-authority-signed transaction exists in-window on either multisig or on the config authority's own account. If the "3-of-5" starting point is real, the transaction that set it predates 2026-03-01 (outside this task's window) or lives on an account not yet identified.

**DEV-008 — RESOLVED with real fixtures.** Searching for a literal `InitializeNonceAccount` instruction across all ~2,750 already-downloaded raw transactions (session 1) plus fresh targeted fetches (session 2) turned up **zero** hits on any of the four addresses session 1 labeled "durable nonce accounts" (`45cZ5F...`, `39JyWr...`, `CZRBcH...`, `48cV6M...`) or on `6UJbu9ut...` ("new member nonce"). Decoding one of `6UJbu9...`'s own transactions (`4BKBmAJn...`, the recovery tx above) showed it uses `AdvanceNonceAccount` — but the nonce account being advanced is a **different address it merely authorizes**: `EmYEryTDXtuVCxrjNqJXbiwr4hfiJajd4g5P58vvhQnc`. **Correction to session 1's labeling:** these five addresses appear to be nonce *authorities*/fee-payers, not the nonce accounts themselves (all five currently read back as 0-byte System-owned wallets, which is also consistent with a genuinely-closed nonce account — this session did not fully resolve which explanation applies to the other four; only `6UJbu9.../EmYEryTD...` was traced end-to-end). `EmYEryTD...` is live today: `getAccountInfo` shows owner=System, `dataLen=80` (a real, currently-Initialized `NonceAccount`), and its entire 2-signature lifetime was fetched: `59yWWZjn...` (2026-03-31T02:35:49Z, `CreateAccount` + `InitializeNonceAccount`, decoded instruction discriminants 0 and 6) and `4BKBmAJn...` (the recovery tx, `AdvanceNonceAccount`, discriminant 4). Both saved as real, unmodified `getTransaction` JSON to `data/fixtures-for-decoder/initialize-nonce-account.json` and `data/fixtures-for-decoder/advance-nonce-account.json`, with `data/fixtures-for-decoder/README.json` describing provenance. No synthetic nonce data was created for the other four addresses — their initialization instructions remain genuinely not found, logged as DEV-026 below rather than fabricated.

`updateWithdrawGuardThreshold()` was searched for by instruction-log name across every transaction fetched this session (both multisigs' full histories, the new-admin wallet's full history) and was **not found**. This remains open (folded into DEV-022's residual scope).

### Session 2 deviations

- **DEV-024 (UNTESTED):** The two `AdminWithdrawFromInsuranceFundVault` transactions' Anchor event logs (`Program data: ...` base64) were not decoded to exact token amounts — this needs Drift's specific insurance-fund-withdraw event IDL/discriminator, which was not fetched this session. The transactions themselves, their signatures, slots, and instruction names are real and verified.
- **DEV-025 (UNTESTED):** No `InitializeNonceAccount` instruction was found anywhere in this session's real RPC reads for the four original session-1 "nonce account" addresses (`45cZ5F...`, `39JyWr...`, `CZRBcH...`, `48cV6M...`). Given the confirmed `6UJbu9.../EmYEryTD...` pattern (an authority wallet whose actual nonce account is a separate address only visible by decoding an `AdvanceNonceAccount` instruction's account list), the most likely explanation is that each of these four addresses is also a nonce *authority* whose real nonce account has not yet been identified — not that the durable-nonce claim is false. Resolving this needs decoding an `AdvanceNonceAccount` call signed by each of the other three authorities (only `CZRBcH...` and `48cV6M...` were checked this session, both non-conclusively — see raw dumps in `data/drift-2026/`).
- **DEV-026 (COSMETIC, corrects session 1):** Session 1's account table (§2) labeled `45cZ5F...`, `39JyWr...`, `CZRBcH...`, `48cV6M...`, and `6UJbu9...` as "nonce accounts." Session 2 shows at least one of them (`6UJbu9...`) is actually a nonce *authority*, not the nonce account itself. The label should be read as "account associated with the nonce-funding activity" rather than "the NonceAccount-typed account," pending DEV-025's resolution for the other four.

## 10. Blocked

Nothing is fully blocked. Session 1's practical blocker (public-RPC rate limiting) is resolved — session 2 ran entirely on Helius with zero 429s and full-history retrieval in 1-2 pages per account. What remains open after session 2:
- The exact 3-of-5→2-of-5 threshold transition (not evidenced in-window on either multisig — DEV-021 residual).
- `updateWithdrawGuardThreshold()` (not found by name anywhere this session).
- Exact dollar/token amounts for the two `AdminWithdrawFromInsuranceFundVault` calls (DEV-024).
- The real nonce accounts (as opposed to authorities) for 3 of the 4 session-1-labeled addresses (DEV-025).
- Full "18 vaults / 128 seconds" multi-vault reconciliation (session 1's original gap, untouched this session).

All five are closable with further targeted RPC calls against already-identified real addresses (the same pattern used successfully throughout session 2), not with speculation or synthetic data.

## 11. Updated verdict

**PARTIAL**, materially stronger than session 1: the admin-hijack path is now fully documented across TWO real multisigs (not one), including the actual malicious-market configuration sequence, two real insurance-fund thefts, and the real recovery transaction — none of which existed in session 1's PARTIAL. It is not FULL because `updateWithdrawGuardThreshold()`, the literal collateral-market-creation instruction (as opposed to a config update of an existing market), the exact threshold-reduction transaction, and full 18-vault reconciliation remain unlocated despite real, targeted, successful RPC access to every account that plausibly holds them. DEV-008 (nonce fixtures) is now TESTED with real data.
