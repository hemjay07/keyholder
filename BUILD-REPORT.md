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

## Failed Attempts & Resolutions
| Step | Error | Attempts | Resolution |
|---|---|---|---|

## Verification Results
| Phase | Command | Expected | Actual | Pass? |
|---|---|---|---|---|
| 1 | `source scripts/env.sh && solana --version && anchor --version && rustc --version` | agave 4.3.0, anchor 1.2.0 | solana-cli 4.3.0 (src:825efd18), anchor-cli 1.2.0, rustc 1.93.0 | ✅ |
| 1 | `pnpm -r typecheck` (orchestrator) | 6 packages pass | all Done | ✅ |
| 1 | `pnpm test` (orchestrator) | decoder + db tests | Test Files 2 passed, Tests 22 passed | ✅ |

## Known Risks (for debug)
- Local Postgres 15 must be restarted after reboot: `export PATH=/opt/homebrew/opt/postgresql@15/bin:$PATH; pg_ctl -D .pgdata -o "-p 5433 -k /tmp" -l pglog.txt start`.
- Native build scripts ignored by pnpm (bufferutil, esbuild, utf-8-validate); JS fallbacks in use.

## Contract Addresses
| Contract | Network | Address | Tx Hash |
|---|---|---|---|

## Environment Variables Added
| Key | Source Step | Value/Description |
|---|---|---|
