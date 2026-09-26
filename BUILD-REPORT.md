# Build Report — Keyholder
Generated: 2026-09-26
Builder: hackathon-build skill (orchestrator + implementation subagents)

## Summary
| Phase | Steps | Status | Notes |
|---|---|---|---|
| Phase 1 | 1.1–1.4 | complete | toolchain, monorepo, Postgres, byte parsers on real fixtures |
| Phase 5 | 5.1–5.x | built + tested; devnet deploy BLOCKED (faucet) | program, example vault, SDK, flip script |
| Phase 4 | 4.1–4.4 | complete except positions (4b) | REST v1, SSE via LISTEN/NOTIFY, SIWS, webhooks HMAC, x402 402 live, badge |
| Phase 3 | 3.1–3.3 | complete | control state for 15 programs (13 resolved with evidence), risk engine (10 rules, correction path), Drift replay 16 real frames + gap frames |
| Phase 2 | 2.1–2.4 | complete (2.4 PARTIAL) | decoders on real txs; live ingest (WS+poller); Drift timeline from real txs |
| Day 0 | 0.1, 0.2 | complete | THESIS-2 AGREE; E-2 wording corrected |

## Deviations from Architecture
| ID | Component | ARCHITECTURE Said | ACTUAL | Reason | Class | Downstream Impact |
|---|---|---|---|---|---|---|
| DEV-001 | Phase 1 Task 1.1 toolchain | PLAN: `curl https://release.anza.dev/agave-install-init.sh`; `npm install -g @project-serum/anchor-cli`; PATH /home/user/... | `sh -c "$(curl -sSfL https://release.anza.xyz/v4.3.0/install)"`; `avm install 1.2.0 && avm use 1.2.0` (avm already present); project `scripts/env.sh` puts ~/.avm/bin first (a stale ~/.cargo/bin/anchor 0.30.1 shadowed it) | plan commands were wrong for this OS and toolchain | COSMETIC | every build shell must `source scripts/env.sh` |
| DEV-002 | packages/decoder | arch/A-decoder.md code (rejected) present on disk | removed (moved to scratchpad); decoder rewritten test-first on real fixtures | rejected contract: placeholder PDA derivation, invented addresses, self-skipping tests | UNTESTED→superseded (new code TESTED) | none |
| DEV-003 | decoder test, rent_collector Some | real fixture | one synthetic buffer for the Some branch only (commented) | no real multisig with rent_collector set among fixtures | UNTESTED | none; replace with a real account when one is found |
| DEV-004 | worker drizzle.config.ts | `driver: 'pg'` | `dialect: 'postgresql'` + `dbCredentials.url` (drizzle-kit 0.31.11) | stale API in contract | COSMETIC | none |
| DEV-005 | schema jobs.id | bigint identity | serial | time-box on untested API | DEGRADED | revisit when the queue is built |
| DEV-006 | version pins | TS 5.3, Next 14, React 18, drizzle 0.30 | TS 7.0.2, Next 16.3.6, React 19.3.0, drizzle-orm 0.45.3 (npm view 2026-09-26) | plan pins stale | COSMETIC | web phase must check Next 16 APIs against arch/D-web.md |
| DEV-007 | root vitest config | — | Vite warns ESM-in-CJS (no root "type":"module") | cosmetic | COSMETIC | none |
| DEV-008 | decoder system-decoder (nonce) | real fixture | built from published layout; no real nonce account fetched (public RPC 403 on getProgramAccounts) | RPC limits | UNTESTED | replay needs real nonce txs from Task 2.4 to upgrade to TESTED |
| DEV-008b | decoder loader tags 0,2,5,6,7 | real tx per tag | tags 1,3,4 tested on Drift's real slot-429,731,225 deploy; others from spec | no real tx found yet | UNTESTED | low: upgrades use tags 3/4 |
| DEV-008c | idl-loader Program Metadata | all data sources | Direct+Json only (the only real shape found); others rejected honestly | one real account | DEGRADED | protocols with URL/External IDLs show "undecoded" |
| DEV-009 | decoder Squads config actions | real tx per action | AddMember real-tested; other actions via the same verified enum decoder | only AddMember in real history of 7qipz… | UNTESTED | threshold/timelock actions need a real tx (devnet flip will produce one) |
| DEV-020 | Task 2.4 backfill | full history via public RPC | public RPC 429-throttled; hub accounts (State, program) page only back to 2026-05-16 in 20,000 sigs | shared public endpoint + two agents | DEGRADED | needs a non-shared RPC (Helius free tier) to reach March on hub accounts |
| DEV-021 | Task 2.4 | council multisig address | Squads v4 program invocation seen; the multisig account itself not yet resolved | budget | UNTESTED | replay frame 3 needs it |
| DEV-022 | Task 2.4 | malicious market creation + withdraw-guard change | not located (CVT mint March window unread) | budget | UNTESTED | replay frames 4 labelled "not retrieved" until found |
| DEV-023 | backfill script | — | unbounded 429 retry fixed to 5 attempts | bug | COSMETIC | none |
| DEV-024 | Task 2.4 | insurance-fund withdraw amounts | event amounts not decoded (needs Drift event IDL) | budget | UNTESTED | replay shows the calls without amounts until decoded |
| DEV-025/026 | Task 2.4 nonces | four nonce accounts | one real nonce account + Initialize/Advance txs found (EmYEryTD…); the other three labels are nonce authorities | session-1 mislabel | COSMETIC | real nonce fixtures now in packages/decoder/test/fixtures (DEV-008 can be closed in Phase 3) |
| DEV-030 | ingest yellowstone.ts | live Triton stream | built + unit-tested on proto-typed updates; disabled (no YELLOWSTONE_TOKEN), not wired | just-in-time credential | UNTESTED | live ingest runs on Helius WS + 30 s poller meanwhile |
| DEV-031 | ingest registry seeds | 15 programs | agent seeded Drift only (no ID source); orchestrator then verified the other 14 IDs on-chain (executable, owner BPF Upgradeable Loader) → apps/worker/src/ingest/verified-programs.json | real-only discipline | COSMETIC (closed) | Phase 3 seeds all 15 from that file |
| DEV-032 | ingest live-check wiring | reconcile admin/state accounts | first run polled the program ID itself (429 storm); fixed to ProgramData + multisig only | bug in script | COSMETIC | none |
| DEV-041 | state authority resolution | resolve all 15 | first pass 1/15 → coordinator-required history resolution → 13/15 with evidence tx/ownership; marinade unresolved (14 sigs, no evidence); squads-v4 immutable | real-only | DEGRADED (1 unresolved) | marinade shows "unresolved: 14 txs scanned" |
| DEV-042 | risk standing rules | per-slot deltas | standing rules emit only on change (engine-level) | noise | COSMETIC (fixed) | none |
| DEV-043 | replay lead time | first alert → drain | posture (standing) reported separately; lead time = first TRANSITION alert (new multisig 2026-03-25T16:58:31Z) → first drain (2026-03-31T07:16:19Z) = 134,268 s (1.55 d), measured | first definition measured a standing condition | COSMETIC (fixed) | demo copy must use the measured 1.55 days, never "9 days" |
| DEV-043c | Squads v3 multisigs | timelock | stored as 0 because v3 has no timelock feature | model simplification | DEGRADED | UI must say "no timelock feature (Squads v3)", not "0 s" |
| DEV-043d | squads-v3-decoder | real fixture | layout tests on synthetic bytes from the real Rust source; live parses succeeded for 5 v3 multisigs | none saved | UNTESTED (unit) | save one live v3 account as a fixture |
| DEV-050 | web x402 | contract withX402(handler,{price}) | installed @x402/next API: withX402(handler, routeConfig, x402ResourceServer) + registerExactSvmScheme + PayAI HTTPFacilitatorClient; unpaid → real 402 (network solana:5eykt4…, USDC, 10000 atomic) | contract stale | COSMETIC | paid leg UNTESTED until a payer holds USDC |
| DEV-051 | web badge | contract gold/dark palette (leaked) | rebuilt on design/TOKENS.css; timelock shown as "1 h / 1 d / none / no timelock feature"; widened to 300 px after a read collision | leaked palette in plan docs (removed at source: plan/PRD.md §6.6, arch/D-web.md, arch/B-worker.md) | COSMETIC (fixed) | none |
| DEV-052 | positions | CLMM, Whirlpool, Kamino, marginfi, Drift users | SPL + Token-2022 real; the five protocol resolvers are stubs returning [] | layouts not yet sourced | UNTESTED | "find your wallet" incomplete until Phase 4b |
| DEV-053 | web env | .env in app folder | apps/web/.env symlink → root .env (gitignored) | Next reads only app-local .env | COSMETIC | none |
| DEV-060 | program check CU | ≤ 8,000 CU | 21,183 CU measured (7-member Squads read); regression ceiling 50,000 | not yet optimised (zero-copy is the named fallback) | DEGRADED | integrators pay ~21k CU per check |
| DEV-061 | program tests | anchor default sBPF v3 | tests run on --arch v1 build (litesvm 0.10 cannot load v3); deploy uses v3 | tooling gap | DEGRADED | none on-chain |
| DEV-062 | attester lowering | quorum-gated | caller-supplied lower_authorized flag (v1); quorum is v2 in ONCHAIN.md | scope | DEGRADED | single attester key must be protected |
| DEV-063 | devnet deploy + flip | deployed, flip run | BLOCKED: devnet faucet refused for 50 min; program ids fixed (keyholder 3FX57MQm…R8F, example_vault 4dj7Nu6j…MNY); deployer Ahfy8W15…U8X unfunded | faucet | UNTESTED | founder funds the deployer from faucet.solana.com |
| DEV-064 | build artefacts | — | programs/keyholder/target was committed by the rejected design-stage agent; untracked + gitignored now | hygiene | COSMETIC | none |
| DEV-065 | devnet flip target | example_vault as the flipped protocol | a dedicated no-op target program (9JT9XMCu…LBJ); example_vault stays the integrator | a coordinator rehearsal handed example_vault's devnet upgrade authority to a demo multisig whose member keys were not saved → example_vault 4dj7Nu6j…MNY can never be upgraded on devnet | DEGRADED | mainnet unaffected; script now saves member keys (600) before anything irreversible |
| DEV-066 | program tests | tests load target/deploy (v3) | scripts/test-programs.sh builds v1 into target/test-sbf; tests load that; deploy artefacts untouched | litesvm 0.10 cannot load SBPF v3 | COSMETIC | always run ./scripts/test-programs.sh |
| DEV-067 | flip stage/execute split | proven as separate processes | `all` runs both in sequence; next-day split and 86,400 s not yet run | time | UNTESTED | run `stage` the day before recording |
| DEV-054 | positions Phase 4b | five stubbed resolvers (Kamino Obligation, marginfi MarginfiAccount, Drift User, Raydium CLMM PersonalPositionState, Orca Whirlpool Position) | all five real: discriminators + owner/authority offsets sourced from each protocol's own repo via `gh api` (Kamino-Finance/klend@a087609, 0dotxyz/marginfi-v2@35b5c66 — mrgnlabs/marginfi-v2 now redirects here, velocity-exchange/protocol-v2@13e8e9b — drift-labs/protocol-v2 now redirects here, raydium-io/raydium-clmm@ed7c84a, orca-so/whirlpools@408c945), each offset independently verified against a live mainnet account fetched via Helius before being hard-coded; 15 new unit tests (5 real-fixture happy paths + 10 edge/error) all passing; live end-to-end run against 3 real wallets resolved their known positions correctly | none — fully sourced and verified | TESTED (unit + live) | marginfi and Drift skip the `dataSize` prefilter (Helius accepted discriminator-only memcmp; dataSize added as a second, redundant filter once measured live) — matches the task's "if Helius rejects a query shape, try the alternative" instruction; Raydium/Orca resolvers cost one getAccountInfo per NFT the wallet holds (bounded by wallet's own NFT count, not a program-wide scan) |

## Failed Attempts & Resolutions
| Step | Error | Attempts | Resolution |
|---|---|---|---|

## Verification Results
| Phase | Command | Expected | Actual | Pass? |
|---|---|---|---|---|
| 1 | `source scripts/env.sh && solana --version && anchor --version && rustc --version` | agave 4.3.0, anchor 1.2.0 | solana-cli 4.3.0 (src:825efd18), anchor-cli 1.2.0, rustc 1.93.0 | ✅ |
| 1 | `pnpm -r typecheck` (orchestrator) | 6 packages pass | all Done | ✅ |
| 1 | `pnpm test` (orchestrator) | decoder + db tests | Test Files 2 passed, Tests 22 passed | ✅ |
| 2 | decoder `vitest run` + tsc (orchestrator) | 2.1/2.2 decoders on real txs | Test Files 7 passed, Tests 78 passed; tsc clean | ✅ |
| 2 | orchestrator getTransaction 9zJGhyot…pPwE (mainnet) | the reported admin hijack | slot 408,886,958, 2026-03-26T01:46:35Z, err None, logs: VaultTransactionExecute → UpdateAdmin, admin E1admb4t…fnob -> AiLGdNit…PKrW | ✅ |
| 2 | Task 2.4 verdict | FULL/PARTIAL/KILL | PARTIAL (research/drift-2026-history.md) | ✅ |
| 2 | orchestrator getAccountInfo 61ApQqLo…GNjP (Helius) | council multisig state | owner Squads v4, disc OK, threshold 2, members 5, time_lock 0, config_authority A1eC8n2t…1xhP | ✅ |
| 2 | orchestrator `pnpm -r typecheck` + `pnpm test` | all green | 6/6 Done; Test Files 14 passed, Tests 132 passed | ✅ |
| 2 | agent 90 s live run (mainnet via Helius) | real rows | 194 raw_tx rows from poller, 0 fetch errors; 0 real-time events in the window (none injected) | ✅ |
| 2 | orchestrator getAccountInfo ×14 | executable programs | all 14 executable, owner BPF Upgradeable Loader | ✅ |
| 3 | orchestrator vitest risk/decoder/worker | all pass | 39/39, 85/85, 97/97; typecheck 6/6 | ✅ |
| 3 | orchestrator getAccountInfo DyJmzHXG…623k… (resolved v4 multisig) | parsed state | owner Squads v4, threshold 4, time_lock 0, members 7 | ✅ |
| 3 | replay run (agent, live DB) | measured lead time | first transition alert → first drain: 134,268 s (1.55 d) | ✅ |
| 4 | orchestrator typecheck + vitest | all pass | 6/6; Test Files 23 passed, Tests 225 passed | ✅ |
| 4 | orchestrator curl badge ×3 + read PNG | correct facts, tokens | drift 4 of 7 / 1 h; jupiter-v6 4 of 7 / no timelock feature; kamino 5 of 10 / 1 d verified; no collisions after widening | ✅ |
| 5 | orchestrator cargo test --workspace | all pass | 18 parser (real bytes) + 9 LiteSVM + 1 CPI = 28 passed | ✅ |
| 5 | devnet flip (agent run, orchestrator confirmed 2 txs) | pass → weaken → refuse | check BEFORE ok; configTransactionExecute 5EXeHqjm… Status Ok (2 of 5, 0 s re-read); deposit AFTER 2pc4PrKs… refused: ThresholdBelowPolicy 6001 (solana confirm -v) | ✅ |
| 5 | orchestrator ./scripts/test-programs.sh | 28 pass | 1 + 18 + 9 passed | ✅ |

## Known Risks (for debug)
- COPY/TRUTH: TEN.md sentence 5 and PRD/demo say the council went "from 3 of 5 to 2 of 5"; on-chain, the council 61ApQqLo…GNjP is 2 of 5 / 0 s and NO threshold change was found in 2026-03-01..04-03 (49 txs decoded). The 3→2 claim is from rekt.news only. Before any surface ships: either find the change on chain (earlier window) or reword to "a 2-of-5 council with no timelock (rekt reports it was lowered from 3)".
- Local Postgres 15 must be restarted after reboot: `export PATH=/opt/homebrew/opt/postgresql@15/bin:$PATH; pg_ctl -D .pgdata -o "-p 5433 -k /tmp" -l pglog.txt start`.
- Native build scripts ignored by pnpm (bufferutil, esbuild, utf-8-validate); JS fallbacks in use.

## Contract Addresses
| Contract | Network | Address | Tx Hash |
|---|---|---|---|

## Environment Variables Added
| Key | Source Step | Value/Description |
|---|---|---|

## Live pipeline wiring (2026-09-26/27)
- Runner + decode/state/risk/verification/alert stages built by agent (stopped at its usage limit before the live run); orchestrator verified: tsc clean, 160 tests.
- Live run 1 (mainnet, 10 min): 4 FALSE risk deltas. Cause: on a Helius 429 the state stage fell back to event-folded facts ("authority -> immutable" and back); base state came from recent events only. Nothing was delivered (0 subscriptions/webhooks). Rows deleted.
- DEV-068 state stage: a failed live read writes nothing (skipped, retried); same upgrade authority keeps the history-resolved multisig; non-authority facts carry over from the last state; change judged on control facts only (multisig address/threshold/members/timelock/config authority). The pre-existing test asserting the fold fallback was REPLACED (it encoded the defect), stated here. Class: DEGRADED (fixes a correctness defect).
- DEV-069 runner: decode ticks never overlap (a slow tick under backoff raced on one protocol).
- DEV-070 tests: every DB test goes through src/test-db.ts (only a `_test` database); schema.test.ts had corrupted the dev Drift row twice (once via vitest started from src/). Proven: from src/ 8 DB files skip and dev unchanged; from apps/worker 160/160 on _test.
- DEV-071 verify-osec: registered build (repo_url set) not verified -> `drifted`; live result 3 verified / 6 drifted / 6 never registered.
- Live run 3 (mainnet, 10 min): 143 raw_tx, events 6,686 total, 0 state writes, 0 risk deltas, one 429 skipped correctly.
- Known: attestation writer not started (no attester key path); Telegram/email/X disabled (no tokens); most decoded events belong to untracked multisigs (protocol_id null) and must not reach the public feed.
