# Keyholder's data moat: plan for the 11 days to submission (2026-10-01 → 10-12)

## The test
A moat is data that (a) compounds with time, (b) can't be recreated later, or only at great cost, (c) gets more useful the more of it there is. Current state of 15 protocols fails all three: anyone reads it from chain in an afternoon. Raw tx history fails (b): any archive RPC backfills it.

## What passes
| asset | why it's hard to copy | compounds by |
|---|---|---|
| 1. The resolved control graph, at full coverage | upgrade authority → the actual multisig → each signer key. Squads vault PDAs only resolve against a known candidate multisig; coral/v3 signers are derived; Realms is its own tree. Doing it for every meaningful program is the work. | every new program indexed |
| 2. Signer overlap across protocols | needs (1) first; nobody publishes "these protocols share signing keys" | every program added grows the cross-links |
| 3. A timestamped observation log | "seen at slot X" can't be recreated later with proof of *when*; a daily hash published on chain makes it verifiable | every day the worker runs |
| 4. An incident benchmark (KeyBench) | past Solana key/admin incidents replayed like Drift: what control signals showed, how early; scored like a benchmark (the founder's field) | every incident added; every rule scored against it |

## Plan (11 days)
| days | build | real-data output | X content |
|---|---|---|---|
| 1–3 | coverage: from 15 to every upgradeable program behind a protocol listed on DefiLlama's Solana page with TVL above a floor; resolve each authority (Squads v4/v3, coral, single key, Realms, immutable) | "N programs, $X TVL: who holds the keys" | protocol of the day becomes "the weakest of N" |
| 2–4 | daily snapshot table: control state of every program per day (keeps history even when nothing changes) + the headline stat: share of covered TVL behind no-timelock multisigs | a trend line from day 1 | one chart per week |
| 3–6 | signer graph: decode every multisig's member keys; find keys shared across protocols; page /signers | the shared-signer finding, whatever it is | the finding (if any), with transactions |
| 4–8 | KeyBench v0: 3–5 past Solana incidents with an admin/upgrade-key path, each replayed from chain like Drift; Keyholder's rules scored (lead time, false alarms) | a results table | one incident per post |
| daily | daily observation hash on devnet (attester), mainnet when SOL allows | a verifiable log | — |

## What it costs
- RPC: Helius free quota ran out on 2026-10-01 (sweep moved to public RPC the same day). Coverage reads are cheap (getAccountInfo); incident replays need archive history = Helius credits. Budget: one paid month (~$49) or a second free key; founder's call.
- Box memory: tight (155 MB free). Coverage runs as a one-off job, not a service.
- Honesty: every incident claim is replayed from chain or not made; a benchmark result is published even if it's unflattering.

## Not a moat (don't spend days on it)
More pages, more 3D, more protocols' marketing names without resolved control.

## Recommendation
Start with 1 → 2 (coverage, then the signer graph): it is the asset everything else stands on and the fastest to show. Run 3 from today (it only needs the existing worker + a daily snapshot). Do 4 in parallel from day 4 with as many incidents as can be verified.
