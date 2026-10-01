# Keyholder: the two judged videos (plan, 2026-09-27, written from verified facts)

Built on Colosseum's own guidance (skills/demo-video/references/DEMO-THESIS.md, top section). Facts come only from the repo and the live record. Anything the founder must supply is marked [FOUNDER]; none of it is filled in for him.

| video | length | job | how |
|---|---|---|---|
| Launch film (built) | 35 s | a feeling, for X; never submitted as the pitch | music only |
| Pitch video | ≤ 3:00 | the why: team, problem, who it is for | the founder on camera + screen (Loom-style), his own voice |
| Technical demo | 2:00–3:00 | the how: features built, stack, decisions, Solana and on-chain logic | real app, code and explorer, his own voice |

## 1. Pitch (≤ 3:00)
| time | beat | on screen | substance |
|---|---|---|---|
| 0:00–0:15 | hook | the launch film's first seconds, then his face | Drift needed two keys to lose $285M; the keys were on chain the whole time. |
| 0:15–0:40 | who he is | on camera; a glimpse of clinicalguard | Draft (his words to replace): a doctor who builds evaluation infrastructure: benchmarks that test whether a clinical AI follows the rules before it touches a patient (clinicalguard, NSTG 2022, 251 conditions). Keyholder is the same discipline for money: measure who can move it before you deposit. Optional clause, only if his contract allows outside work: "and I ship production fintech software at a YC company" (the company unnamed). |
| 0:40–1:10 | the problem, for whom | the live home table: 10 of 13 resolved protocols have no timelock | Depositors and vault/treasury builders can't see who can move the money. |
| 1:10–1:50 | what it does | record (table + console), alert (the real 25 Mar alert body), refuse (the devnet refusal) | Three jobs; on Drift the first alert came 5.6 days before the money moved. |
| 1:50–2:20 | the proof | the Drift replay | 25 Mar first alert → 31 Mar first withdrawal. |
| 2:20–2:45 | validation, business | [FOUNDER] real conversations or replies, if any | No traction is recorded in the repo: claim none. Who pays: [FOUNDER]; the x402 paid API exists in code ("exists", not "earns"). |
| 2:45–3:00 | close | wordmark + URL | Count the keys. |

## 2. Technical demo (2:00–3:00)
| time | beat | on screen (real) | decision to explain |
|---|---|---|---|
| 0:00–0:15 | map | architecture: chain → worker (decode, state, risk, alerts) → Postgres → web/API; the Anchor program on devnet | one sentence per box |
| 0:15–0:50 | RECORD | a protocol page (e.g. Marinade 6/13, "checked N min ago"); code: the authority resolver, the Squads v4 / v3 / coral decoders | read the upgrade authority from chain and resolve it to its multisig; write state only on a good read (a 429 once produced a false change); the 10-min sweep + last-checked record |
| 0:50–1:25 | ALERT | the 10 risk rules (packages/risk); the Drift replay's first alert; the signed webhook body + X-Keyholder-Signature | rules on control facts, not price; HMAC-signed delivery |
| 1:25–2:25 | REFUSE | /policy proof strip; Solana Explorer (devnet): pass → weaken → refused 6001, 23 s apart; the vault's cpi_check call | the vault asks by CPI before a deposit; Keyholder reads the target's authority and multisig accounts itself, so the answer is chain state; Squads v4/v3/coral read, Realms refused as unknown (said on the page) |
| 2:25–2:45 | own control | /policy: Squads v4, 2 of 3, 48 h timelock, no config authority | same rule applied to ourselves; devnet only, mainnet not deployed |
| 2:45–3:00 | next | one line each | mainnet; Realms; [FOUNDER] priorities |

## Rules
- His own voice; no TTS.
- Every number is read from the app or chain at recording time.
- Say "devnet" and what is not live (mainnet; Telegram/email/X alerts; Realms).
- The launch film is at most the first 10 s of the pitch.

## What I can prepare before he records
1. A 15 s architecture visual in the film's style.
2. A shot list with exact URLs and the three Explorer links, so each section is one take.
3. A rehearsal pass: every screen loaded, every link live, no waits.
4. A judge-proxy score of his first take against the DEMO-THESIS checklist.
