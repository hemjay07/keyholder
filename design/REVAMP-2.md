# REVAMP 2 — Keyholder (2026-09-27, founder: "we skipped many things … no icon … the UI doesn't reach the bar")

**The one job:** show who can move the money in every Solana protocol, and make it felt the moment that control weakens.

## Why revamp 1 missed the bar (audit, not excuses)
Measured against plan/CREATIVE.md (the direction we agreed, 20 references) and the pipeline:
1. **No identity.** No logo, no favicon, no share image. `logo-forge` never ran.
2. **The console is built from primitives** (boxes, cylinders, a torus). CREATIVE §7 and the founder rule (2026-09-19) say the device comes from a real modelled object. It reads as hand-made.
3. **Promised devices never built:** the replay's time brush and drain (§5 frames 1–7), the Atlas of Control scrub (concept B), the slot ribbon (ref 11), the "loader that is a number" (ref 18), the per-protocol mini-consoles on the wallet page, the before → after console on event pages, feed type glyphs and filters, the ⌘K palette, the dark theme, and Departure Mono on the readouts.
4. **Pipeline stopped at build.** Debug, wire, verify, stress, deploy, live test, interrogate, demo and package never ran. The site is not public; there is no README.
5. Two facts in CREATIVE.md are now known false and must not ship: "3→2" (the council was 2 of 5 throughout) and "9 days" (the lead is 5.6 days).

## Page by page (what changes, what is kept, why)
**0. Identity (new).** Mark: two key bows crossing (the 2-of-N idea), one signal-orange notch; wordmark in Geist caps. Deliverables: SVG mark, favicon and apple icon, a 1200×630 share card per page (protocol pages get their live console state), X avatar. Via `logo-forge`, tested at 16 px.

**1. The device (all pages).** Replace the primitive console with a real modelled console: Blender-quality GLB (Tripo from a written brief, or a CC0 panel model, then hand-fitted), baked AO, Poly Haven brushed-metal PBR for the bezel, Departure Mono for readouts, text as decals, not floating text. Keys, needle and lamps stay separate parts so data still drives them. *Kept:* every behaviour and the waiting/unresolved states.

**2. Home.** *Kept:* headline, the four-beat scroll story, the table. *Changes:*
- a first-load "loader that is a number": the count of protocols read ticks up while the console assembles (ref 18);
- the status strip becomes a slot ribbon (ref 11): one tick per recent slot, orange where a control change landed;
- table rows open an inline mini-console instead of a new page;
- dark theme toggle.

**3. Replay (the demo centrepiece).** Rebuilt as §5 described, with true facts:
- a time brush from 1 March to 3 April under the console;
- frames scrub the console (the second multisig appears as a second key rail; the admin key moves; the lamp lights on 25 March);
- the alert we would have sent appears as a phone notification with its timestamp;
- on 31 March the ground turns to the dark trace texture while the withdrawals run (ref 8);
- the vault's check refusing is shown at the first alert;
- choreography in Theatre.js, so timing is editable.
*Kept:* the step list with transactions, the citations.

**4. Feed.** Type glyphs and filters (upgrade, authority, multisig settings); severity number leads each row (ref 2); the seismograph becomes a time brush that filters the list; `j/k` keys.

**5. Protocol page.** A control map drawn as a plan (ref 6): program → upgrade authority → multisig → keyholders, each member an address chip. The changelog as a Linear rail (ref 16). A badge that says "checked N min ago".

**6. Event page.** Before → after console side by side, what we know and what we do not, correction history.

**7. Wallet.** Each protocol holding money is a small live console in a grid, weakest first; one switch "alert me on all of these".

**8. Alerts / For vaults / Proof.** Alerts: rules in plain language. For vaults: the gate row becomes 15 mini-consoles that fail visibly. Proof: kept, with the new device.

**9. Global.** ⌘K / `/` palette (protocol, program id, wallet, signature); every state is a URL; dark theme; view transitions.

## Pipeline, after the build
deploy (public URL) → live test in your Chrome → interrogate → README → demo rehearsal → demo video → package → preflight.

## Order of build
identity → device model → replay → home → feed + protocol + event → wallet + vaults → palette + dark theme → deploy → pipeline. Measured at 390/760/1280 and headed after each; judged side by side against the reference screenshots in plan/research/refs.

## Refused
- Particles or gradient meshes: they don't count a key.
- A seismograph as the product: control changes are steps, not tremors.
- Any copy from CREATIVE.md that is now known false (3→2, 9 days).
