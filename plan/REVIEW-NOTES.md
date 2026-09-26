# Coordinator review notes (for the manager; 2026-09-26)

## PRD.md defects (must be fixed in the merged plan, not carried over)
1. Leaked design system: §6.6, line 757 and line 939 specify a "Crypto Casino Dark" gold palette. That comes from an unrelated project's CLAUDE.md (/Users/mujeeb/CLAUDE.md, "MicroRoulette"), not from this product. Visual direction is CREATIVE.md's job; delete every palette/logo instruction from the PRD.
2. Invented results presented as metrics: line 824 "23 Telegram subscribers", line 829 "3,400 unique visitors", and "127 events / 47 upgrades in first 7 days". These are guesses. Replace with the metric definitions and targets marked as targets; the submission reports only what is measured.
3. Scope cuts contrary to the founder's instruction ("build the main thing fully"; deadlines never cut scope, only the founder does): lines 159, 197, 268, 371, 405, 474, 551, 592, 957 defer Squads v3/v5, privileged-instruction decoding, email, webhook signing, IPFS, the on-chain program, firehose/x402 to "V2". Line 598/997/970 propose mock x402 payments, hardcoded responses and injected mock events. The plan must sequence all of these into the 16 days (surface trimmed last, depth first) and use real payments and real events; a "fallback if late" may be named, never planned as the default.
4. Name: the PRD uses "Upgrade Watch"/upgrade-watch.com; the product is the control plane, not upgrades. Name is open; pick from CREATIVE.md's line and PRD §1 candidates.
5. Size claim in its report ("~7,500 lines") is wrong: 1,026 lines, 64.7 KB.

## ONCHAIN.md (read the report; accept)
Derived facts (loader ProgramData, Squads v4 threshold/time_lock/members/stale_transaction_index) read live in `check`; attested facts one-sided (one attester can raise risk; lowering needs quorum or delay). Squads Borsh Option trap after offset 94: parse field by field, test on real bytes day 1. Drift replay is "reconstructed"; the live proof is a devnet threshold flip.

## CREATIVE.md first pass REJECTED (2026-09-26)
Awwwards/Are.na cited by homepage only, 0 screenshots, stock dashboard stack (shadcn/Tremor/Recharts), leaked gold #F59E0B palette from /Users/mujeeb/CLAUDE.md (unrelated roulette app). Redo running with the browser: 30+ specific references with screenshots in plan/research/refs/. Seismograph concept kept only as a candidate.
Root cause for both leaks: /Users/mujeeb/CLAUDE.md is auto-loaded into every agent working under /Users/mujeeb; every future agent prompt must say to ignore it.
