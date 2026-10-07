# Revamp 3: rethinking what Keyholder gives out (plan, 2026-10-07)

Status: PLAN. Nothing is built until the founder approves it. Deadline 2026-10-13 06:59 UTC.

## 1. What Keyholder gives out today
| output | who gets it | how |
|---|---|---|
| alerts when one of 15 protocols' control weakens | a person who signs up | email / web |
| a yes/no check before a deposit | a vault program | CPI to the devnet program, which re-reads the multisig itself |
| a page per protocol, a feed, a Drift replay | a reader | website |
| KeyBench, the $769M figure | a reader | one subpage |

Everything is shaped as **monitoring for a person**. The assets we built since (557 programs to signer keys, $2.66B traced to vaults, a dated anchored log, replayed incidents, signer overlap, admin keys, closures) are not outputs at all: they sit in `data/` and on the box.

## 2. What the data lets us give out instead
The one thing nobody else has: **for any money on Solana, who can move it, how fast, and a provable record of how that changed.** That is not an alert product; it is a **reference**: the way credit ratings are a reference for debt. A reference is consumed by machines and institutions first, people second.

### The new core outputs
| # | output | what it is | who consumes it | why they pay or care |
|---|---|---|---|---|
| **A** | **Control Record** (per program, per day) | a signed record: upgrade authority → multisig → signers, threshold, timelock, admin keys, $ held, verified build; one per program per day, hashed and anchored | everything below is built on it | it is the asset: dated, provable, and it compounds daily |
| **B** | **Control Grade** | a published, versioned grade per program (e.g. A–F) computed only from the record: key count, timelock, single-key admin fields, recent changes, closures, history; the method is public, KeyBench is its back-test | wallets, aggregators, launchpads, lenders listing collateral, risk desks | one number they can show users or gate on, defensible because the method and the back-test are public |
| **C** | **On-chain Control Oracle** | the grade and the key facts written on chain per program (a PDA per program, updated when the record changes); the existing check program reads it | vaults, lending markets, routers, any program | any program can refuse money where control is weak, without re-implementing multisig parsing; the current check only reads three multisig layouts |
| **D** | **Control Feed (API + webhooks)** | every change to any record as an event: authority changed, threshold or timelock changed, program closed, governance proposal touching control, admin key changed | security teams, funds, exchanges, insurers, bots | real-time signal on 557 programs, not 15 |
| **E** | **Exposure** | for a wallet, a fund, or a protocol's integrations: every position mapped to the keys that can move it, $ by grade | users, funds, protocols checking their dependencies | "who can move my money" answered for a portfolio |
| **F** | **KeyBench** | the public back-test of B and D against every control incident, misses included | judges, buyers of B, researchers | it is the proof that the grade means something |

### What gets demoted
- The 15-protocol monitor becomes a view of D filtered to a watchlist.
- The Drift replay becomes one KeyBench incident.
- The console device becomes the visual for one program's record, not the brand.

## 3. What has to be built (product, not pages)
| output | exists | to build |
|---|---|---|
| A Record | daily log of 557 programs (authority, kind, multisig, threshold, members), anchored | add $ held, admin keys, verified build, timelock and closures to each record; sign the record (attester key); publish per-day JSON |
| B Grade | nothing | grade v1: a rule table over the record, versioned; back-tested on KeyBench (each incident's grade the day before the loss); published method page |
| C Oracle | check program on devnet (reads Squads v3/v4, coral itself) | a `ControlGrade` account per program written by the attester when the record changes; check program reads the grade account; SDK call `require_grade(program, min)`; devnet |
| D Feed | live decoder for tracked protocols; daily diffs | diff engine over daily records for all 557 → events; public JSON API (`/api/v1/programs/:id`, `/api/v1/changes?since=`); webhooks reuse the alert dispatcher |
| E Exposure | `/wallet` (tracked protocols only) | map token accounts and positions to owning programs through the vault index from the dollar census; grade-weighted $ |
| F KeyBench | 5 incidents | score the grade per incident (grade at T-1 day); keep misses |

## 4. Surfaces derived from the outputs
| surface | serves | shows |
|---|---|---|
| Home | everyone | the state of Solana control: $ by grade, the worst-graded money, today's changes, search |
| Program page | wallets, users, judges | the record + grade + history + proof for one program |
| Signer page | security teams | what one key can move across Solana |
| Changes | security teams | output D as a page |
| Grade method + KeyBench | buyers, judges | how B is computed and back-tested |
| Proof | skeptics | each day's anchor, verify in the browser |
| Developers | integrators | API, webhooks, `require_grade` in a vault, devnet demo |
| Exposure | users, funds | output E |

## 5. Order (6 days)
| day | product work |
|---|---|
| 1 | Record v2 (add $, admin keys, closures, build) + per-day JSON export; Grade v1 + back-test on KeyBench |
| 2 | Feed: diff engine over records, public API v1 |
| 3 | Oracle: ControlGrade account + attester writer + check program reads it (devnet), SDK call |
| 4 | Exposure (vault index); surfaces: home, program, signer |
| 5 | surfaces: changes, method + KeyBench, proof, developers; measure and read every render |
| 6 | README, submission, demo script for the new product; founder records |

## 6. Risks and what is not promised
- Grade v1 is a published rule table, not a model; its back-test is 5 incidents, said so.
- The oracle ships on devnet; mainnet needs SOL and an audit.
- $ figures stay floors for the 33 largest programs; others show control without $.
- Six days is tight for A–F. If time runs out, cut in this order: E (Exposure), then Signer page, then webhooks. A, B, C, D, F are the product.

## 7. Founder decisions needed
1. Is the reference (record → grade → oracle → feed) the product, or do you see the core output differently?
2. Grade as letters A–F, or a 0–100 score?
3. Cut order if time runs out: E first, as above?
