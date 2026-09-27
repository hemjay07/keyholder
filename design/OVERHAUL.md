# OVERHAUL — Keyholder, every page and feature (2026-09-27)
Founder: "build everything that was missed and build it well, don't rush, always use the right agent persona or skill … we go over every page and feature, total overhaul … plan well and follow the plan till the end this time."
Supersedes REVAMP-2.md. Every promise has a row in design/PROMISES.md (P-ids below); the fence refuses "done" while a row is open.

**The one job:** show who can move the money in every Solana protocol, and make it felt the moment that control weakens.
**Deadline:** 12 Oct 2026 23:59 PT. Demo video recorded by 9 Oct. Today 27 Sep.

## How every page is built (the method this time)
1. **Spec first.** Each page below has: job, what a judge must get in 3 seconds, layout at 390 / 760 / 1280, device, data (real source), states (loading, empty, error, stale), copy, motion, acceptance. Nothing is built that is not in its spec; anything added goes into the spec first.
2. **Right tool per piece:**
   - identity: `logo-forge`;
   - device: `fetch-part` (PBR, fonts), the parametric model exported to GLB;
   - UI: the SURFACE kit (measure, founder-view, render-judge against the references);
   - backend: `implementation-agent`, then `testing-agent`, then `code-reviewer`;
   - copy: `humanizer` pass;
   - README: `docs-writer`;
   - pipeline: `hackathon-stress`, `deploy-to-github`, `hackathon-livetest`, `hackathon-interrogate`, `hackathon-demo-rehearsal`, `demo-video`, `hackathon-package`, `hackathon-verify`.
3. **Each page closes only when:**
   - measure passes at 390 / 760 / 1280 and headed in the founder's Chrome;
   - a render-judge comparison against its named reference screenshot has run;
   - its PROMISES rows are ticked with commit and evidence;
   - it is shown to the founder before/after.
4. **Progress is reported against PROMISES.md and the pipeline state only.**

## 0. Identity (P01–P04) — logo-forge
- **Mark:** two key bows crossed at the shaft, one signal-orange notch where they meet (2 keys = the Drift sentence). Works in one colour. **Wordmark:** KEYHOLDER, Geist, tracked caps.
- **Deliverables:** mark.svg, favicon (16/32, with the mark simplified to the notch + one bow at 16 px), apple-icon 180, a share card generated per route (Next `opengraph-image`): home = the console + headline; protocol = its live console state + "N of M keys, timelock"; event = before → after; replay = "5.6 days of warning."; X avatar and header.
- **Acceptance:** readable at 16 px in a real browser tab; the share card checked in X's card validator crop.

## 1. The device (P05–P09) — shared by every page
- **Model:** a parametric console built in code and exported to `design/parts/console.glb`:
  - bevelled extrusions for bezel and face;
  - recessed key wells;
  - a machined dial ring;
  - screw heads with real slots.
  - Materials: ambientCG brushed-aluminium / anodised PBR (fetch-part pbr), baked AO. Labels and scale as texture decals in Departure Mono (fetch-part font), not floating text.
- **Moving parts stay separate** (keys, needle, lamps, readout), driven by data exactly as now.
- **Variants:** full (hero), mini (tables, wallet grid, vault gate: keys + lamp + timelock only, 2D-cheap), flat (fallback / reduced motion).
- **Acceptance:** at 1280 the judge can read every label; frame p95 ≤ 16.7 ms headed; side by side with ref 9 (OP-1) and ref 5 (launch console) the render-judge says it reads as an object, not a drawing.

## 2. Home `/` (P10–P13)
- **Job:** in 3 s, "who can move the money; Drift needed two keys"; in 30 s, the story and the table.
- **1280 layout:**
  - nav;
  - slot ribbon (P12) replaces the text strip: one tick per slot of the last ~10 minutes, orange where a control change landed, with the live counts on its right;
  - the four-beat scroll story with the console;
  - the 15-protocol table, whose rows expand inline to a mini-console (P13);
  - latest changes;
  - footer.
- **390:** ribbon one line; console once; pinned state strip; table stacked; rows expand.
- **First load (P11):** the number of protocols read counts up 0→15 while the console assembles; under 1 s; skipped on repeat visits and reduced motion.
- **States:** RPC read fails → the ribbon says "last read N min ago", table keeps the last snapshot, labelled stale.
- **Copy pass:** humanizer; every figure with its source.

## 3. Replay `/replay/drift` (P14–P20) — the demo centrepiece
- **Job:** the Drift story felt; 5.6 days of warning, each step a transaction.
- **Layout:** the console centre-stage, with a time brush under it (1 Mar – 3 Apr, day ticks, alert markers, drain markers); the step list beside it on desktop and below it on a phone. Dragging the brush or scrolling moves the same state.
- **Frames (facts corrected):**
  1. 2 Mar: the council, 2 of 5, no timelock (standing risk, lamp dark).
  2. 25 Mar: the second multisig appears as a second key rail on the console; the lamp lights; the alert arrives as a phone notification with its UTC time (P16); the vault check beside it turns to REFUSED (P18).
  3. 26 Mar: admin key moves (readout), market 85 switched on and limits raised (rows stack).
  4. 31 Mar 02:35: durable nonce.
  5. 31 Mar 07:16: first withdrawal; the ground turns to the dark trace texture (P17), vault counters drain.
  6. 1 Apr: the $285M, the recovery, the swaps.
  7. End card: "5.6 days of warning. Count the keys."
- **Choreography:** Theatre.js sheet (P19), timings editable, exported state committed.
- **Every frame URL-addressable** `/replay/drift?t=2026-03-25T16:58Z` (P37).
- **Acceptance:** the whole replay plays in ≤ 90 s autoplay for the demo video; each frame cites its transaction; "reconstructed" on every rebuilt state.

## 4. Feed `/feed` (P21–P23)
- Rows lead with a severity number (P22): 5 authority changed, 4 multisig settings changed, 3 upgrade on a protocol with no timelock, 2 upgrade with a timelock. Each row has a type glyph.
- Glyph filters (P21) plus a protocol filter; the seismograph is a draggable time brush filtering the list (P23); `j/k` moves between rows and `enter` opens one.
- Live: a "reading chain now" dot from the runner's heartbeat; a new row slides in without reload (SSE).
- **States:** runner down → "last read N min ago".

## 5. Protocol `/protocols/[slug]` (P24–P26)
- **Hero:** its console and headline.
- **Control map (P24):** drawn as a plan, program → ProgramData → upgrade authority → multisig (type, threshold, timelock, config authority) → each keyholder as an address chip; immutable and Realms-governed variants drawn accordingly.
- **Changelog rail** (built).
- **Badge:** adds "checked N min ago" (P26).
- **Citations.**
- **Share card:** its live state.

## 6. Event `/events/[uid]` (P27–P28)
- Before → after: two consoles side by side (mini at 390).
- What we know (decoded fields, transaction) / what we don't know (e.g. why; the signer's identity).
- Correction history.

## 7. Wallet `/wallet` (P29–P30)
- After a read: a grid of mini-consoles, one per protocol holding the wallet's money, weakest first, each linking to its page.
- "Alert me on all of these" → /alerts with the protocols preselected (P30).
- Waiting state keeps the 3D console.

## 8. Alerts `/alerts` (P31–P32)
- Rules in plain language (P31): "tell me when required keys drop", "… when the timelock falls under 24 h", "… when the program is upgraded".
- Channels: webhook (live); Telegram when the founder supplies a bot token (P32); email and X marked not live.
- A test-send button that posts a signed sample to the webhook.

## 9. For vaults `/policy` (P33–P34)
- The gate row becomes 15 mini-consoles that turn on and off as the policy changes (P34).
- The copyable Rust call (built); the devnet program id.

## 10. Proof `/proof` (P35)
- Built; the new device; the share card.

## 11. Global (P36–P40)
- ⌘K / `/` palette: search protocols, program ids, wallets, signatures; jump anywhere (P36).
- Every state a URL (P37).
- Dark theme as a full second theme, from the CREATIVE §4 dark column (P38).
- View transitions between pages (P39).
- LCP < 1.5 s on throttled 4G, measured on the public URL (P40).
- A real 404 page; loading skeletons per route.

## 12. Pipeline (P41–P46)
1. hackathon-stress (load + failure injection on the API and runner);
2. deploy (web on Vercel, runner + Postgres on a host; secrets via the host, never in git);
3. hackathon-livetest in the founder's Chrome on the public URL;
4. hackathon-interrogate;
5. README (docs-writer, one fold);
6. hackathon-demo-rehearsal;
7. demo-video;
8. hackathon-package;
9. hackathon-verify preflight.

## Schedule
| dates | work |
|---|---|
| 27–28 Sep | identity; device model + mini/flat variants |
| 29 Sep – 1 Oct | replay (centrepiece) |
| 2 Oct | home (ribbon, loader, inline rows) |
| 3 Oct | feed + event |
| 4 Oct | protocol control map + wallet grid + vaults gate + alerts rules |
| 5 Oct | palette, dark theme, transitions, 404, copy pass |
| 6 Oct | stress, deploy, livetest, interrogate |
| 7 Oct | README; fixes from livetest |
| 8–9 Oct | demo rehearsal + video |
| 10–11 Oct | package, preflight, buffer |
| 12 Oct | submit |

## Needs from the founder
- Telegram bot token (optional; P32 stays open without it).
- Hosting accounts for deploy (Vercel login; a host for the runner and Postgres). Asked at the deploy step, with the one command to run.
- 10 minutes at each founder gate: identity sheet, device render, replay, then the headed review.
