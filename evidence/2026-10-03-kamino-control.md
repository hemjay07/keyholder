# Kamino Lending: who controls what (2026-10-03, mainnet)

All values: liquidity sitting in reserve supply vaults (not borrowed amounts), priced via Jupiter at 2026-10-03 19:32:45 UTC,
mints with >= $100k liquidity only. Reserves: 593 (8624-byte accounts), every vault's mint matched its reserve (0 mismatches).
Data: `data/coverage/kamino-markets-2026-10-03.json`, `data/coverage/admin-keys-2026-10-03.json`. Scripts: `scripts/keybench/kamino_markets.py`, `apps/worker/src/coverage/admin-keys.ts`.

## Control layers
| layer | controller | rule to act |
|---|---|---|
| program upgrade (KLend2g3…) | Squads v4 6hhBGCtm…, vault 0 GzFgdRJX… (derived and matched) | 5 of 10, timelock 86,400 s |
| main markets' owner (lendingMarketOwner) | 24LjDBuk… = vault 0 of Squads v4 7idEEVRi… (derived and matched; executed UpdateReserveConfig 2026-10-02) | 4 of 10, timelock 43,200 s; 9 of 10 signers shared with the upgrade multisig |
| side programs CanarFx…, SLendK7y… | same signer set | 1 of 10 (see 2026-10-03-threshold-1-owners.md; ~$10k) |

## Value by market-owner kind
| owner kind | USD in supply vaults |
|---|---|
| PDA (Squads vault) | $1,469,434,991 |
| single_key | $9,927,594 |

The 133 markets whose owner is a single key (on-curve) hold $9,927,594 together. A market owner can change
its reserves' configuration. These look like third-party markets on Kamino's program; their owners are not identified here.

### Largest single-key-owned markets
| market | owner key | USD | reserves |
|---|---|---|---|
| `8BNUWRSibVasaAmhYpBCFpGgMisGKfVAf9ho3Cmf6vjr` | `7fLxEftpppneavpueYgP2s7HhSGbWpj2jTCmAEwwqonY` | $7,593,201 | 4 |
| `HMNm3ZrAvG4zKVv5zpMDA6DKduc612156RUsdAAZf4TC` | `De9x4akGAgNJ7YLZBEKgkyvR9aBZ8HkUcVpT4S3at8qG` | $2,330,048 | 2 |
| `BBmb1SYx1MiJjeCFbGtrP8FcV9XJ3uYd4dLHhe1NbwAP` | `Ed3T7tukRawu8atGhwb2QZyA4NzP9kvjVUKo5qJYJaPK` | $1,024 | 4 |
| `3tiR48uv5nEMkPoVQ36TzfXCMk7tkCW5TCAcRvin8ZnZ` | `Ed3T7tukRawu8atGhwb2QZyA4NzP9kvjVUKo5qJYJaPK` | $928 | 6 |
| `ER9fWfY6jk3RfqsdXrEH9VbF8TECZE6XCZMjauF6yiRz` | `sadmBTQm5HJsyzWHEjV4YwG9CiahZKVDVqAyS4Wx1zH` | $486 | 5 |
| `GjY9kg9XTSErTqAAy4ikBWBxHrh6xh9GZnpLLTY33dXe` | `ARygwR6WBPvatQ2bBrSyytsyBgqrRDwxEuANWSSydfXW` | $396 | 2 |
| `ApPhTXdqEBxd3aCGENbJDga11ncAXqGcdgBYU8PdzVoD` | `BnkgH4woGZcgn3vTjEuZ78D4AqSYDRrtdzsWaWPhWDMG` | $295 | 2 |
| `5o3y37r1VuRXTaG5APnp76re1pWXyV7K7158ppEfqJhn` | `sadmBTQm5HJsyzWHEjV4YwG9CiahZKVDVqAyS4Wx1zH` | $207 | 3 |
| `5zyaPPU4vMJHMpJfKQfvVCRVpr3ctPNTth66GiQviunX` | `CTWvbW6vihruM84VxNJJmAu2WmoftwF72RshZVGPdPzC` | $197 | 2 |
| `DLwibRz7UuY1v2DHwxJSTxFaffrZm8WbfYHvJPusdTGC` | `Bq4KMaVvzemx4tyfoyhZ7Kooo494GEv1xq9MLgRkfF6j` | $178 | 6 |
