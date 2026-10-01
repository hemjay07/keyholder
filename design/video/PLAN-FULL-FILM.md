# Keyholder launch film: the full-film plan (2026-09-27)

## What it is for
The public launch of Keyholder on X (1080x1080), and the opening of the hackathon demo. A viewer who has never heard of Drift must leave with one idea in ~35 s: **control of a protocol is a few keys; Keyholder counts them and warns before they are used; Drift had 5.6 days of warning.** Close on "Count the keys." and the wordmark.

## The bar
The @twoclipping prompt (skills/launch-video/references/SEEK-FILM-PROMPT.md) and the Tessel film: one continuous take, every scene made from the previous one, something on every beat, nothing that looks like a template. Test cuts 1 and 4 were accepted with fixes; cut 4 (ink) chosen.

## Founder rules that bind this film (his words in FOUNDER.jsonl)
- Engine A (seek(t) HTML), music only, no narration.
- Letters never squash on one axis; they leave one at a time.
- Masked text lands in ~0.2 s, never reads as cut off.
- Real data only; orange means warning and nothing else.
- Never show him a render I have not read frame by frame.

## Inputs
- Song: Mixkit 115, 68 beats from 23.44 s (beats2.json), drop on film beat 28 (14.2 s), quiet dip beats 18–22.
- Screens: the site in its dark theme (design/shots/dark-home.png), so the film never flashes light.
- Facts: Drift council 2 of 5, no timelock; first alert 25 Mar 16:58 UTC; first withdrawal 31 Mar 07:16; lead 5 d 14 h; weakest five today (Marinade 6/13, marginfi v2 7/15, Jupiter v6 4/7, Meteora DLMM 4/7, Sanctum router 4/7); 10 of 13 with no timelock.

## Beat map (68 beats, ~34.6 s, ink ground)
| beats | act | what happens | made from |
|---|---|---|---|
| 0–7 | Open | `keyholder.` centred; letters drop into the dot one at a time (2–6) | — |
| 7–11 | Claim | the dot stretches into a pill; "Drift needed two keys" rises (8.5) | the dot |
| 11.5–15 | Keys | the pill splits into 5 keys; key 1 turns orange (12.5), key 2 ink (13); "to lose $285M." (13.5) | the pill |
| 15.8–24 | Record (quiet dip) | the key row becomes the table: the 5 weakest protocols fill the frame, orange edges draw; "10 of 13 have no timelock" (19.5); the cursor finds Marinade and clicks (24) | the key row |
| 25–27.6 | Iris | six blades close over the table | the click |
| 28 (drop) | Live | the iris snaps open onto the live site (dark); screen-studio zoom to the weakest list (29–31.5), then to the 5.6-day strip (32–35) | the iris |
| 35.8–51 | Warning | the site lifts away; the axis draws; the orange dot lands on 25 Mar (38); the band stretches to 31 Mar while the counter runs 0d 00h → 5d 14h (39–47); "5.6 DAYS OF WARNING" (47.5); "then $285M left in minutes" (49.5) | the site's own strip |
| 52–54.8 | Flood | the band floods the frame orange (0.35 s), holds a beat, contracts into a pill | the band |
| 55–61.4 | Line | "Count the keys." inside the orange pill | the flood |
| 61.8–63 | Close | the pill closes into the dot | the pill |
| 63–68 | Return | the dot goes home; the letters spring back out; last frame = first frame | the dot |

## Fixes found in the draft stills (all must be gone before the render)
1. Wordmark not centred (container has no top): centre it at y 455, dot on the baseline.
2. Protocol rows wrap and clip: name 44 px on one line, dots 18 px, meta "6/13" only.
3. Rows 4 and 5 overlap while stacking: stagger by row, springs start below the frame bottom, not at the key row.
4. The zoom shows the light site: use the dark capture.
5. "then $285M left in minutes" never shows in stills: check its mask timing.
6. The home screen appears twice as a thumbnail (tile 9 and 10): the zoom must fill the frame from the first open frame.

## Build and QA
- Preview: 30 fps x 2 subframes; final: 60 fps x 4 subframes (render.js from the kit).
- QA (kit qa.py): duration = song, a frame per beat read as a sheet, zero pops, −14 LUFS ±1; last frame compared to frame 0.
- Gate before the final render: this plan + 4 stills (open, record, live, warning) to the founder.
- Deliver: keyholder-launch.mp4 (1080x1080 60 fps) + a 1920x1080 version for the demo opening, if he wants it.

## Not in this film (and why)
Liquid glass (the prompt's technique): it needs photos behind it; Keyholder's material is flat UI and numbers, and glass on flat colour reads as a gimmick. The iris, the flood and the morphs carry the continuity instead.
