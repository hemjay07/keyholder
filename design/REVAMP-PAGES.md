# REVAMP — every page, re-derived (2026-09-27)
Founder: "i feel like we have overloaded and things are not well thought out … lets get this right now". Replay done first (REVAMP-REPLAY.md, ac9627a). This file covers the rest. Read against today's 1440 captures in design/shots/audit-*.png.

## The one job
Show who holds the keys to each Solana protocol today, and warn before that control is used against users.

## Three problems across the whole site (seen in the captures)
1. **Every page is the same template:** text on the left, the 3D console on the right (home, protocol, event, wallet, alerts, proof). Six pages look like one page, so none of them is memorable.
2. **The product sits below the story.** On home the protocol table, which is the live record, starts at 2,500 px, under three Drift beats that retell the replay.
3. **Two pages for one reader:** "For vaults" (/policy) and "Proof" (/proof) both answer a vault builder's question. The nav has 6 entries for 5 jobs.

## Rule for the console
The console appears only where it reads **one** real control state: a protocol, a wallet result, the devnet proof, the replay. It does not appear on pages about many things (home list, feed, alerts, policy) or as decoration.

## Nav (6 → 5)
Protocols (/) · Changes (/feed) · Drift replay · Your wallet · Alerts · For vaults (/policy, with the proof inside it). /proof stays as a URL and redirects to /policy#proof.

## Page by page
### / Home: "who holds the keys, today"
- KEEP: the headline "Drift needed two keys to lose $285M." and "Count the keys."; the slot/protocol strip; the table; latest changes.
- CHANGE: first fold = headline on the left; on the right, **the live table's top 5 rows as key-dot rows** (weakest first), not the console. The full table follows right after, with no gap. The 3D console is cut from home.
- CHANGE: the three Drift story beats (the 1,500 px of scroll) → **one strip**: the replay's two lanes at small scale, the orange band, "5.6 days of warning", and a link to the replay.
- REMOVE: "Scroll: the console replays what the chain showed", the 4 dashes under the console, and the "Who holds the keys" header that repeats the headline.

### /feed Changes
- KEEP: the headline, the per-day tick chart, and the rows (they work).
- CHANGE: clicking a chart tick scrolls to its day; a protocol filter (chips, from the data); the sub line counts the rows it shows ("6 changes in 30 days" while showing 5 months confuses).
- REMOVE: nothing.

### /protocols/[slug]
- KEEP: the console (one state: this protocol), the headline "Pump.fun: 3 of 4 keys, no timelock", and the changelog.
- CHANGE: under the hero, **its own lanes** (upgrades · authority changes · verification) over its full history with a now-line, same grammar as the replay; the changelog becomes the lanes' transcript. Merge the citations into one line under the headline (they repeat it). The badge embed moves to the bottom, behind "Embed this badge".
- REMOVE: the "Programs" section as a separate block (one line in the hero meta).

### /events/[uid]
- KEEP: the headline sentence, the transaction, and the decoded fields.
- CHANGE: no 3D. The hero is the event as **one tick on the protocol's lanes** (the same lanes as the protocol page, this event highlighted), so the reader sees where it sits in history. The console today shows *today's* state beside a 23 Sept event, which misleads.
- REMOVE: the console.

### /wallet
- KEEP: the question, the input, and the sample-wallet link.
- CHANGE: the result is **one row per position** (protocol, key dots, timelock, weakest-first) with the console reading the weakest one; the empty state is the input alone, centred, with no idle console showing "? of ?".
- REMOVE: the idle console.

### /alerts
- KEEP: the headline, the 3 steps, the honest channels line, and sign-in.
- CHANGE: the right side becomes **the alert itself**: the real Drift 25 Mar alert rendered as the webhook payload / a message, with its timestamp. That is what the user is signing up to receive.
- REMOVE: the console.

### /policy For vaults (absorbs /proof)
- KEEP: the policy playground (slider, timelock, pass/refuse bar, rows) and the footnote.
- CHANGE: order = headline → **proof first** (the 3 devnet transactions as a three-step strip: pass → weaken → refused 6001, with the console reading the devnet multisig) → "try your own policy" playground → the Rust call → "Who controls Keyholder" → program list.
- REMOVE: /proof as a separate nav entry.

## Order of work
Home → policy+proof → protocol → event → wallet → alerts → feed. Each is measured at 390 and 1440, click-tested, and shown before/after before the next one starts.

## Not changing
Palette, type, the console model, the data pipeline, and the OG cards (the OG for /proof is kept for its redirect target).
