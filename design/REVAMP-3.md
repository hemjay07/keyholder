# Revamp 3: Keyholder, the control standard for Solana (plan v2, 2026-10-08)

Status: **PLAN, waiting for founder approval.** Built once, after approval. Supersedes plan v1 (A–F grade and a lagging grade oracle are dropped: opinion invites liability and gaming, and an oracle written later is stale when it matters).
Inputs: `design/REVAMP-3-BRAINSTORM.md` (5 brainstormers, market scan). Founder decision 2026-10-08: Stages + live enforcement + Proof of Control + signer intelligence; no time cap; the UI is rebuilt too, motion-led.

---

## Part 1. The product

### The one job
**For any money on Solana: who can move it, how fast, whether that changed, and whether it matches what the team promised.**

### What Keyholder gives out
| # | output | for | form |
|---|---|---|---|
| 1 | **Control Stage** (0–3) per program, from public rules over chain facts | users, wallets, funds, judges | web, badge, API |
| 2 | **Control Record**: the facts behind the stage, each with its proving transaction, plus daily history anchored on chain | anyone who needs to trust the stage | web, API, per-day JSON |
| 3 | **`require_stage`**: an on-chain guard any program calls; reads the target's control live | vaults, lending markets, routers | Anchor program + SDK |
| 4 | **Proof of Control**: a protocol's signed claim of its intended control, checked against chain daily; broken claims alert | protocols (the customer), their users | claim file + badge + alerts |
| 5 | **Signer intelligence**: per signer key, every multisig and program it controls, $ behind it, activity; contagion alerts | security teams, exchanges, funds | web, API, alerts |
| 6 | **Control Feed**: every change across all covered programs (authority, threshold, timelock, members, admin keys, closures, proposals, claim breaks) | everyone above | web, API, webhooks, email |
| 7 | **KeyBench**: the stage and the feed back-tested on real incidents, misses kept | judges, adopters | web |

### 1. Control Stages: the rules (v1, published on `/stages`)
A program's stage is the **lowest** stage any of its control paths reaches. Control paths: the upgrade authority, and every admin field in program config we can read.
| stage | rule (all facts read from chain) |
|---|---|
| **0** | any control path is a single key (on-curve), or a multisig with threshold 1, or unresolved |
| **1** | every path is a multisig with threshold ≥ 2, but at least one has no timelock (0 s, or Squads v3 / coral without one) |
| **2** | every path is a multisig with threshold ≥ 2 **and** a timelock ≥ 24 h, or governance with a hold-up ≥ 24 h |
| **3** | the program is immutable, or every path's delay is ≥ 7 days (users can exit before a change lands) |
Modifiers shown beside the stage, never changing it: **unknown admin fields** (no IDL, admin config not read), **changed in last 30 days**, **claim broken**, **closed**.
Each stage is versioned (`stages/v1`); every program page shows which rule set graded it and the exact facts. Stage history is recomputed from the daily log for every day since 2026-10-02.

### 2. Control Record
Per program per day: program id, programdata, upgrade authority, authority kind, multisig (address, version, threshold, members, timelock, config authority), admin fields read from config (field, key, kind), $ held (from the vault census, priced daily), verified build (OtterSec repo + commit), stage + rule version, and the anchor (day hash, memo signature). Published as `/data/records/<day>.json` and per program. Changes between days are the feed.

### 3. `require_stage`
- The existing check program (devnet) becomes the `keyholder_guard` program with one instruction: `require_stage(target_program, min_stage, min_timelock_s)`.
- It derives the target's programdata, reads the upgrade authority, and if it is a multisig (Squads v4, v3, coral) reads threshold and timelock **live in the same transaction**; immutable passes; a single key fails stage ≥ 1.
- Admin fields are not readable generically on chain; the guard checks the upgrade path only, and says so in its docs. Off-chain stage (with admin fields) is the full picture.
- SDK: `@keyholder/guard` with a CPI helper and a TypeScript builder. Example vault on devnet refuses a deposit into a target below its policy (the existing demo, re-pointed).

### 4. Proof of Control
- **Claim format** (`keyholder-claim.json`, signed by the program's upgrade authority or a key it designates in the claim, published at a URL the protocol controls or posted as a memo): programs, intended authority kind, threshold, members (optional), minimum timelock, admin fields.
- **Check:** daily (and on every feed event) compare claim to record. Match: "claim holds since <day>". Break: an alert to subscribers and a red line on the program page, with the transaction that broke it.
- **Badge:** an SVG served per program (`/badge/<id>.svg`) showing stage and claim status; protocols embed it.
- **Seeding:** with no protocol claims on day one, every program starts with "no claim". We file example claims for our own devnet programs and, as the demo, a claim reconstructed from Drift's pre-attack state, so the replay shows the claim breaking on 2026-03-27 (timelock to zero).

### 5. Signer intelligence
- **Signer index** from every decoded multisig: key → multisigs (threshold, role) → programs → $ behind (sum of programs' traced $) → stage of each.
- **Overlap:** pairs and groups of keys that recur across multisigs; "contagion set" for a program = programs sharing ≥ 2 signers with it.
- **Activity:** last signature time per signer (cheap: getSignaturesForAddress limit 1), and signing counts on multisig transactions where decoded.
- **Alerts:** signer added or removed anywhere; a signer of one program signs for a program that just weakened.
- **Not done, on purpose:** no names or identities for keys.

### 6. Control Feed
- Sources: daily diffs of records (all covered programs) + live decoded events (tracked programs) + claim checks.
- Event kinds: authority changed, threshold changed, timelock changed, member added/removed, admin field changed, program closed, program upgraded, proposal touching control, claim broken, stage changed.
- Delivery: `/changes` page, `/api/v1/changes?since=`, webhooks and email (existing dispatcher).

### 7. KeyBench (kept, extended)
- Add each incident's stage the day before the loss (from replayed facts) beside the lead time.
- Keep misses; keep "rule added after this study" labels.

### Data and API work (no UI)
| item | done when |
|---|---|
| D1 stage engine `packages/stages` (pure, versioned, tested on fixtures for every rule edge) | unit tests pass; stage for all programs in latest record computed |
| D2 record v2 in the daily job (admin fields, $, build, stage) + per-day JSON export | a day's JSON validates against its schema; anchor still verifies |
| D3 stage history backfill from `program_daily` since 2026-10-02 | every program has a stage per day |
| D4 signer index + overlap + contagion sets | index built from coverage; counts reconcile with multisig members |
| D5 claim schema + signature check + daily claim checker | tests: valid claim holds; altered chain breaks it; bad signature rejected |
| D6 feed diff engine over records | diff of two fixture days yields the expected events |
| D7 public API v1 (`/api/v1/programs/:id`, `/stages`, `/signers/:key`, `/changes`, `/records/:day`) | contract tests on each route |
| D8 `keyholder_guard` + SDK + devnet example | program tests pass; devnet refusal transaction recorded |

---

## Part 2. The experience

### Direction
The site is a **live instrument for Solana's control**, not a report about Drift. Every motion renders a fact arriving or changing (kit rule: motion is caused by data). One visual system runs through every page: **the Stage ladder** (four rungs, 0 at the bottom, programs as points climbing it) and **the control chain** (program → authority → multisig → signers, drawn as a wire that lights when read).

### Signature moments (built from kit parts, measured)
1. **The map (home).** All covered programs as instanced points (instanced-grid / points-particles), sized by $ and settled into four stage bands as the record loads; scroll (scrolltrigger-pin) re-sorts them by $, then by "changed this week". The $769M is an odometer (number-odometer) counting as the no-timelock band fills.
2. **The chain draw (program page).** The control chain draws node by node as each fact resolves; each node carries its proving transaction (mono-address). The existing 3D console stays as the program's instrument: keys = signers, needle = timelock, lamps = claim holds / weakened.
3. **The stage climb.** A stage change animates the program's point moving one rung, with the transaction that caused it; the same animation in the feed and in KeyBench.
4. **The contagion web (signer page).** A force graph (d3-force) of the key, its multisigs and programs; contagion sets light in sequence.
5. **The claim seal (Proof of Control).** A claim renders as a sealed card; a break cracks the seal at the breaking transaction (Drift demo).
6. **Page transitions.** View transitions between list → program → signer keep the selected point in place (view-transition).
Motion law: one easing family, durations from tokens, everything final-state under reduced motion, p95 frame ≤ 34 ms measured at 390 and 1280 on a production build, headed run before shipping.

### Page by page
| route | status | job | what it shows | motion |
|---|---|---|---|---|
| `/` | REBUILT | the state of Solana control in one screen; find any program | the map (points by stage), $ by stage, the odometer, search (program, protocol repo, signer), today's changes ticker (live-ticker), KeyBench strip | map settle, odometer, ticker |
| `/programs` | NEW | the registry | every program: stage, path summary (n of m, timelock), $, claim status, last change; filters (stage, no timelock, changed this week, closed, claim broken, holds > $1M) | row reveals, filter re-sort with FLIP |
| `/programs/[id]` | NEW (replaces `/protocols/[slug]`) | the whole answer for one program | stage + rule facts with proving txs; control chain; console; admin fields; $ by token; claim status; stage history strip (daily, each day linked to its anchor); contagion set; changes | chain draw, console, history strip scrub |
| `/signers/[key]` | NEW | what one key can move | multisigs, programs, $ behind, stages, activity, overlaps, contagion web | contagion web |
| `/stages` | NEW | the rules, public and versioned | the four rungs with exact rules, counts and $ per stage, how to move up (what a team must change), changelog of rule versions | ladder climb on scroll |
| `/changes` | REBUILT (was `/feed`) | every control change as it lands | the feed with kinds, filters, stage-change animation per row; subscribe | stage climb per row |
| `/claims` | NEW | Proof of Control | how to file a claim (schema, signing), claims on file and their status, the Drift demo claim breaking | claim seal / crack |
| `/keybench` + `/keybench/[id]` | REBUILT (absorbs `/replay/drift`) | would Keyholder have warned | incidents with lead time and stage the day before; per incident replay (Drift player generalised to all five) | replay player |
| `/build` | NEW (replaces `/policy`) | for developers | `require_stage` in one snippet, devnet refusal proof, API reference, webhooks, badge embed | code reveal, refusal replay |
| `/watch` | REBUILT (merges `/wallet`, `/alerts`) | your exposure + alerts | paste a wallet: positions → programs → stage; subscribe to those programs and their signers | rows resolve as each position is read |
| `/proof` | REBUILT | the record can't be rewritten | each day: rows, hash, anchor tx; verify in the browser (recompute hash from the day's JSON) | hash computes visibly, match lamp |
Redirects: `/feed`→`/changes`, `/policy`→`/build`, `/wallet` and `/alerts`→`/watch`, `/replay/drift`→`/keybench/drift`, `/protocols/[slug]`→`/programs/[id]`. `/events/[uid]` folds into `/changes`.

### Navigation (one entry per destination, named for what the user gets)
Programs · Signers (via search) · Changes · Stages · Claims · KeyBench · Build · Watch · Proof · ⌘K search over programs, repos and signer keys.

### Identity
Mark and wordmark kept; the stage glyph (four rungs) becomes the system's icon; share images per page (home: the map; program: its stage + chain; signer: its web); badge SVG.

### Process (kit)
UI work runs through `/surface` (founder starts it): charter refresh → specimen of the map and the chain draw → founder gate on the specimen → build → measure every page at 390 and 1280 (production build, cold loads, headed run) → read every render → founder gate on headed screens. `design/PROMISES.md` gets one row per signature moment above.

---

## Part 3. Order of work
1. **Data and engine:** D1 stages, D2 record v2, D3 history, D4 signers, D6 feed diff, D5 claims, D7 API.
2. **Guard:** D8 `keyholder_guard` + SDK + devnet example.
3. **Surface specimen:** the map and the chain draw, measured, founder gate.
4. **Pages:** program, registry, home, signer, stages, changes, claims, keybench, build, watch, proof; redirects and nav.
5. **Measure and read everything;** headed run; founder gate on screens.
6. **Ship:** box deploy (daily job v2), Vercel, README, demo script rewritten, submission text; founder records.
Deadline 2026-10-13 06:59 UTC stays the submission line; the founder said time is not the constraint, so nothing in this plan is cut for it. If the deadline arrives first, what is built and verified ships, and the rest continues after.

## Part 4. Not promised
- No identities for signers; no ownership claims beyond what the chain proves (repos are "built from", not "owned by").
- Stage 2+ needs admin fields read; programs without an IDL show "admin fields unknown" and cannot reach Stage 2 until read (stated on the page).
- `require_stage` checks the upgrade path only; mainnet deploy needs SOL and review.
- Dollar figures stay floors for the largest programs; the rest show control without $.

## Founder gates
1. Approve this plan (or strike or change pages).
2. Start `/surface` for the UI when data work (step 1) is done; specimen gate before pages are built.
