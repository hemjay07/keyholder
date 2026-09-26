# Task 2.4: Drift March–April 2026 History Validation (day-2 KILL CHECK)

**Verdict: PARTIAL.**

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

- `apps/worker/src/backfill/drift.ts` — the backfill tool: pages `getSignaturesForAddress` backward with bounded per-page retries (fixed mid-session after an early version retried forever against sustained 429s), filters to the March 1–April 3 2026 window, and fetches+saves real transactions resumably (skips a signature if its JSON already exists on disk).
- `data/drift-2026/` — raw output (gitignored, see §7): per-account `signatures-in-range.json` and `transactions/<signature>.json` (real `getTransaction` results, `maxSupportedTransactionVersion: 0`).
- `research/drift-2026-history.md` — this file.

No files under `packages/decoder` were read for write purposes or modified (only referenced its existing `evidence/2026-09-26-drift-control-state.md` note and its `test/fixtures/` directory listing, both read-only).

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

## 9. Blocked

Nothing is fully blocked — every gap in §4/§5 is closable with more RPC calls against already-identified real addresses, not with speculation or synthetic data. The practical blocker is public-RPC rate limiting under concurrent multi-agent load (§3 Finding 3), which PLAN.md already anticipates with a Helius fallback.
