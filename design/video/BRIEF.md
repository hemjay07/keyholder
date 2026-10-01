# Keyholder launch film: the shared brief for the 4-cut test (2026-09-27)

Every cut uses these inputs, and only the variable named in its row may differ.

## Fixed inputs
- Product: Keyholder, a public live record of who controls each Solana protocol (keys, threshold, timelock).
- Wordmark: `keyholder` (lowercase in the film). Line: "Count the keys."
- Tokens: ground #E6E2D9, ink #1B1A17, ink-2 #5A564E, signal #FF5A1F (orange means ONE thing: warning / weak control), panel #F4F1EA.
- Faces: Geist (UI, sans), Geist Mono (numbers, labels). Local files: /Users/mujeeb/controlplane/apps/web/src/lib/og/Geist-Regular.ttf and GeistMono-Regular.ttf.
- Real facts only (read from the live record 2026-09-27):
  - "Drift needed two keys to lose $285M." Drift's admin council: 2 of 5 keys, no timelock.
  - First Keyholder alert 25 Mar 2026 16:58 UTC; first withdrawal 31 Mar 07:16 UTC → "5.6 days of warning" (5 d 14 h).
  - Weakest control today: Marinade 6 of 13 (no timelock feature), marginfi v2 7 of 15 (none), Jupiter v6 4 of 7 (no timelock feature), Meteora DLMM 4 of 7 (no timelock feature), Sanctum router 4 of 7 (none).
  - 10 of 13 resolved protocols have no timelock.
- Screens (2x-free PNGs): /Users/mujeeb/controlplane/design/shots/home-fold-1440.png, rv-money-1440.png, protocol-marinade-headed-1280.png, alerts-1440.png. The live site runs at http://localhost:3000 if a fresh capture is needed.
- Song: /private/tmp/lv/cuts/song.wav (Mixkit track 115, ~117.5 BPM, cut to 20.5 s, loudnorm -14 LUFS). Beat times in /private/tmp/lv/beats.json (`beats[i]` seconds from 0; beat ≈ 0.5108 s; the drop is beat 16 ≈ 8.17 s).
- Output: 1080x1080, 30 fps preview quality, H.264 + AAC, ~20 s. File: /private/tmp/lv/cuts/cut<N>.mp4

## Relay object
The orange dot. It is the dot of the wordmark, becomes the lamp / the first of the turned keys, becomes the alert mark on 25 March, stretches into the 5.6-day band, and floods back into the wordmark's dot. Last frame = first frame.

## Beat map (40 beats)
| beats | scene | on screen |
|---|---|---|
| 0–3 | open | `keyholder` wordmark; the letters squeeze into the orange period |
| 4–7 | problem | the dot becomes a black pill; "Drift needed two keys" rises inside it |
| 8–11 | keys | the pill splits into 5 key circles; 2 fill; "to lose $285M." rises |
| 12–15 | record | the key row becomes the top row of a table: Marinade 6/13, marginfi 7/15, Jupiter 4/7, orange edges; "10 of 13: no timelock" |
| 16 (drop) | turn | a click on the first row: screen-studio zoom into the real site (home-fold screen) |
| 17–27 | warning | the timeline: orange dot at 25 Mar, a band stretches to 31 Mar while a counter runs 0d 00h → 5d 14h; "5.6 days of warning" |
| 28–33 | flood | the band floods the frame in ink, holds a beat, contracts into "Count the keys." |
| 34–39 | return | "Count the keys." collapses into the orange dot; the letters spring back out: `keyholder.` = frame 0 |

## Rules (from references/SEEK-FILM-PROMPT.md)
No crossfades, blur-ins, 3D flips, particles, glows, or holds over 1 s. Every change lands on a beat. Every scene is made out of the previous one.

## QA every cut must pass before it counts
1. Rendered and playable (ffprobe duration within 0.2 s of the song).
2. One frame per beat extracted and read.
3. Pop scan: no single-frame difference spike more than 3x its neighbours.
4. Audio loudness -14 LUFS ±1.
