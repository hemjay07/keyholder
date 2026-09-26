# Build Report — Keyholder
Generated: 2026-09-26
Builder: hackathon-build skill (orchestrator + implementation subagents)

## Summary
| Phase | Steps | Status | Notes |
|---|---|---|---|
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
