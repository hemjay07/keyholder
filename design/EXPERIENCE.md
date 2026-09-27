# EXPERIENCE — Keyholder as one directed film (2026-09-27)
Founder: "everything should gel … nice flowing progressive animation mirroring some kind of video … we need to maximize the opportunity to make the perfect experience."
Research: design/research/EXPERIENCE-REFS.md + contact sheets in design/research/refs/. Verified by reading the sheets: Lando Norris, Lusion, The Pudding (women's sizing), Uncommon. La Revoltosa capture is blank (cookie wall): its notes are unverified and not used. Linear not re-read.

## What the references actually do (seen in the frames)
1. **One stage, transformed — never replaced.** The Pudding keeps one chart on the same axis for the whole story; each step adds a band, moves a highlight, fades what is no longer the point. The reader never re-orients. *(pudding-sizing sheet, rows 1–3.)*
2. **One note at a time.** The Pudding's annotation is a single small card beside the stage that changes per step; the stage carries the meaning, the card names it. *(same.)*
3. **Chapters change the ground, not the layout.** Lando Norris moves lime → olive → cream → black between sections; the grid and type stay. The colour of the page is the chapter marker. *(lando-norris sheet, rows 1–4.)*
4. **Shape bridges sections.** Uncommon's blue silhouette becomes the city skyline that becomes the next section's edge: one form hands over to the next instead of a cut. *(uncommon sheet, row 1.)*
5. **The object holds, slowly alive.** Lusion holds one 3D scene for the whole fold with constant slow motion; text is minimal and still. Motion is the object's, not the page's. *(lusion sheet.)*
6. **Type assembles, then stops.** Lando's statement lines build word by word, then hold still while the collage moves around them. Nothing reads while it moves.

## The rules for Keyholder (every page obeys these)
- **R1 One stage per page.** The console (or, on data pages, one chart) is the stage. Everything else is a note on the stage or a lane under it. No floating cards in corners.
- **R2 Transform, don't swap.** A step changes the stage's state (keys turn, needle swings, a lane fills, a band appears); it never replaces the stage with another picture.
- **R3 One note.** One caption changes per step: date, one sentence, its transaction. The alert and the vault check live *inside* the stage (the console's lamp and LAST readout, a lane), not as extra cards.
- **R4 Orange is time.** Orange marks only the warning window (alert → money). Severity is shown by position and weight, not a second colour.
- **R5 Chapters are ground.** Bone = before; a warmer, darker bone = the warning window; ink = the money moving; back to bone for "today". The layout never changes between chapters.
- **R6 The console never leaves.** Between pages it moves to its new frame (shared-element transition); it is never unmounted and remounted.
- **R7 Scroll and Play are the same.** Scrolling advances the story; Play scrolls for you. One timeline drives both (Theatre.js sheet as the single source of timings).
- **R8 Nothing reads while it moves.** Text sets in 240–320 ms, then holds; the object moves slowly and constantly (Lusion), text does not.
- **R9 Honest time.** Steps are grouped into moments; a small to-scale strip always shows real time. Nothing implies days that did not pass.

## The replay — shot list (the demo centrepiece)
Stage: the Drift admin console, centred, three-quarter; under it **three lanes** on one real time axis (1 Mar → 3 Apr): *Keyholder* (alerts), *Admin key* (who holds it), *Money* (withdrawals). A single vertical "now" line crosses the lanes and the console's LAST readout says the same moment. One caption above the lanes. Five moments; scroll or Play moves between them; Prev/Next move one moment; each moment expands to its transactions on click.

| # | moment | ground | camera on console | lanes | caption |
|---|---|---|---|---|---|
| 0 | open (0–4 s) | bone | slow push-in to the key row: two keys turned of five | empty; axis draws left→right | "Drift's admin council: 2 of 5 keys, no timelock. It stayed that way the whole time." |
| 1 | 2 Mar — routine | bone | holds | Admin key: council bar begins | "A routine settings change. This is what 'normal' looked like." |
| 2 | 25 Mar 16:58 — **the alert** | warm bone | pull back; lamp lights; LAST types the alert | Keyholder lane: a mark; **orange window begins** and starts filling toward the right | "The council's signers create a second multisig with no timelock. Keyholder's first alert." |
| 3 | 26 Mar — takeover | warm bone | slight turn; LAST: "admin moved" | Admin key lane: bar hands over to "new address"; three admin actions stack as ticks | "Drift's admin role moves to the new address. A market is switched on, its limits raised." |
| 4 | 31 Mar 02:35 → 07:16 — **the money** | ink (dark) | lights dim; lamp holds | Money lane: first drop; **orange window closes** and its length labels itself "5.6 days" | "A durable nonce is staged. Hours later, the first withdrawal. 5.6 days after the alert." |
| 5 | 1 Apr — $285M | ink | holds, still | Money lane: the drops cluster; Admin lane: recovery mark | "$285M leaves in minutes. The admin role is taken back too late." |
| 6 | end card | bone | slow orbit | all lanes at rest; the orange window glows once | "5.6 days of warning. Count the keys." + [See today's weakest protocol] [Watch it refuse on-chain] |

- **Navigation:** on first visit the replay plays moment 0→2 on its own and stops on the alert with "Scroll or press → to continue". Scroll wheel / trackpad / swipe advance one moment per gesture (snapped, not free); ←/→/space work; the lanes are clickable (jump to that time); each moment has a URL (`?m=2`); Play runs 0→6 in ~55 s for the demo.
- **Vault check:** a fourth lane appears only in moment 2 onward: "A vault using Keyholder" — PASS until the alert, REFUSED from then; one line: "illustrative policy; the real on-chain refusal is on Proof."
- **Phone:** the console on top (small, still), the lanes become a vertical timeline under it, the caption between; swipe moves moments.

## Home — shot list
- 0 s: ground bone; the console assembles (bezel, face, keys drop into wells) while the protocols-read count ticks 0→15 (the loader that is a number); headline sets.
- Scroll 1: the console's key row slides down out of the console and becomes the first row of the protocols table (shape bridge, Uncommon rule): 15 rows of key dots, weakest first; the ten with no timelock carry the orange edge.
- Scroll 2: one row is picked (the weakest today) and the console re-forms around it: "Right now: Marinade, 6 of 13, no timelock feature."
- Scroll 3: a teaser of the replay: the three lanes at small scale with the orange window, "5.6 days of warning" → click opens the replay, the console travels with you (R6).
- The long table and latest changes follow as calm, still content.

## Protocol page
- Arriving from home or the feed, the console flies from its row into the hero frame and reads the protocol's live state (keys turn to its threshold, needle swings to its timelock).
- Under it, its own lanes (upgrade authority, program upgrades, verification) over its full history, with a "now" line at today; the changelog is the lane's transcript.

## Proof page
- One stage: the devnet console. Three moments (pass → weaken → refuse), same lane grammar as the replay: a *Vault* lane shows PASS, then REFUSED; ground goes warm at the weakening. The Rust call slides in only after the refusal.

## Page-to-page
- Nav click: the current stage's console shrinks/moves to the next page's console position (View Transitions API + shared R3F canvas); the ground crossfades to the next chapter colour; text of the new page sets after the console lands (never simultaneously).

## Build order (replaces REVAMP-2 order for UI)
1. Motion system: one timings file (Theatre.js sheet) + shared persistent canvas across routes + view transitions. (P19, P39)
2. Replay on the lanes grammar (P14–P18 redone), measured, shown to founder.
3. Home sequence (P11–P13), protocol hero flight, proof lanes.
4. The rest inherit the rules.

## Open questions for the founder
None blocking. Default taken: autoplay-once on first replay visit (the research recommends scroll-only; the demo needs Play; both drive one timeline).
