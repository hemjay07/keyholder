# REVAMP 1 — Keyholder (2026-09-27, founder: "a UI revamp that takes the UI, 3D and animations to the next level")

**The one job:** show who can move the money in every Solana protocol, and make it felt the moment that control weakens.

Everything below is derived from that job. The console is the product's one object; the revamp makes it a real instrument and lets it *act* the story instead of sitting beside text. Tokens (design/TOKENS.css) stay fixed: bone ground, ink, one signal orange, one verified green. Motion stays inside MOTION-RULES (≤ 1.6 s cap, reduced-motion pair for every moment).

## The device (shared by every page) — what changes
| now | after | why (from the job) |
|---|---|---|
| flat grey slab, even light, low-detail metal | studio-lit instrument: Lightformer key + rim lights, anodised face with a fine brushed roughness map, bevelled bezel, engraved row labels | an instrument people trust reads as machined, not drawn |
| key sockets are discs; keys are sticks | keyswitches with a knurled barrel and a flat bow; turned keys lit by a thin signal ring | "count the keys" must be literal on the device |
| dial is a flat circle | glass-fronted gauge (transmission), printed 0 / 1H / 24H / 48H scale, needle with a counterweight | the timelock is a delay; a gauge reads as time |
| lamps are flat discs | emissive lamps with bloom; WEAKENED lamp pulses once when it lights | the alarm must look like an alarm |
| camera fixed; right edge clipped at 1280 | framed so the whole panel sits inside the frame at every width; slight parallax to the pointer (off under reduced motion) | nothing clipped; the object feels present |
| entrance: keys turn once | entrance kept, plus the readout types in | same moment, sharper |

## Page by page
1. **Home** — *changes:* the hero becomes a pinned scroll story. The console holds centre-right while the left column steps through the Drift story in four beats: (1) **2 of 5, no timelock** (the council as read on-chain), (2) 25 Mar: a second multisig appears → lamp lights, LAST reads the step, (3) 26 Mar: admin key moves, (4) 31 Mar: first withdrawal, 5.6 days later. Each beat drives the device (keys, lamp, readout). Then the page releases into "who holds the keys" (the 15-protocol table) and the rest. *Kept:* headline, count-the-keys line, status strip, table, rails, TEN list. *Removed:* nothing.
2. **Protocol** — *changes:* device gets the new instrument; under it a per-protocol seismograph of its own control changes (same component as /feed). *Kept:* changelog, badge, citations.
3. **Feed** — *changes:* seismograph ticks draw in per day with a stagger; a live dot shows the runner is reading chain now (SSE heartbeat); rows fade in. *Kept:* everything.
4. **Replay** — *changes:* the console becomes sticky on desktop and steps with the reader: each step row, when centred, sets the device to that step's state. *Kept:* span bar, step list, citations.
5. **Wallet** — *changes:* after a read, the verdict line counts up (odometer) and the table rows reveal in weakness order. *Kept:* form, device.
6. **Alerts / For vaults / Proof / Event** — *changes:* new device everywhere it appears; proof page device animates from before (3 of 5, 10 s) to after (2 of 5, none) when scrolled into view. *Kept:* content.
7. **Global** — Lenis smooth scroll site-wide; page-to-page view transitions on the kicker/headline; nav underline slides between entries.

## Refused (and why)
- A dark "cinematic" theme: the tokens are the brand; drift.mjs would flag it and it breaks the ledger feel.
- Particles / gradient meshes: decoration that does not count a key.
- Text-to-3D model for the console: thin flat objects stay parametric with real materials (DEVICE.md, SEAL 2026-09-20).

## Order of build
device material/lighting/geometry pass → framing fix + parallax → bloom → home pinned story → replay step sync → proof before/after → feed + wallet motion → Lenis + transitions → measure every page at 390/1280 (+ headed) → judge vs gate-4 screenshot.

## Status
- designed: this file.
- built / tested: see PROGRESS.md entries after 2026-09-27 03:00Z.
