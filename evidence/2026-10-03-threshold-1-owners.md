# Threshold-1 multisigs: who they belong to (2026-10-03, mainnet slot ~452,981,324)

Method: chain reads only (public RPC). Ownership is never taken from a repo that lists an id
(Kamino's `scope/*-itf` crates declare other protocols' ids). Two first-party signals:
the program binary's embedded security.txt, and signer sets shared with a program whose owner is known.
security.txt alone does not prove the deployer (any fork of the source carries it).

| program | multisig (owner program) | live state | security.txt | chain link | verdict |
|---|---|---|---|---|---|
| KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD (reference) | 6hhBGCtm… (Squads v4) | 5 of 10, timelock 86400 s | — | OtterSec-verified build of Kamino-Finance/klend | Kamino main lending, the reference set |
| CanarFxHDSnbrPmrE79Qq6hL2p7ZMyyV4ZLTKQ6g7tpK | HCmFNRNz… (Squads v4) | **1 of 10**, timelock 14400 s, configAuthority none | none | **same 10 members as KLend2g3's multisig** | controlled by Kamino's signer set |
| SLendK7ySfcEzyaFqy93gDnD3RtrpXJcnRwb6zFHJSh | CGokZcw3… (Squads v3, SMPLec…) | **1 of 10**, no timelock in v3 | name "Kamino Lending", security@kamino.finance | **9 of 10 members shared with KLend2g3's multisig** (2RJJ1ZZp… in place of BEUTwDjL…) | controlled by Kamino's signer set |
| SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f | 6fxK7rUd… (Squads v3) | **1 of 4** | name "Switchboard V2", security@switchboard.xyz | none found | self-declared Switchboard V2; owner not yet confirmed |

Activity (getSignaturesForAddress, limit 1000):
- SLendK7y: 1000 txs between 2026-09-27 and 2026-10-03 (live).
- CanarFx: 1000 txs between 2026-10-02 and 2026-10-03 (live).
- SW1TCH7q: newest tx 2026-08-25; 1000 txs back to 2025-05-20 (low use).

Safe to say now: "Two live programs controlled by the same 10 signers as Kamino's main lending
program need only one of those signers to upgrade (1 of 10), while the main program needs 5 and waits 24 h."
Not safe yet: what SLendK7y and CanarFx hold or do for Kamino users (TVL at risk not measured),
and anything naming Switchboard as the controller of SW1TCH7q.

Single-key programs (10 in the money layer): no security.txt in any of them; owners still open.

## What the two Kamino-signer programs hold (2026-10-03)
- SLendK7y: 3,755 owned accounts; 93 reserves (8624-byte accounts) across 25 lending markets. All 93 supply vaults
  checked: each is a token account whose mint equals the reserve's mint (offsets 128 mint, 160 supply_vault confirmed).
  Vault balances, largest: 4,823.77 USDC, 295.1 KMNO, 21.93 JitoSOL, 7.50 SOL, plus small amounts of ~10 other mints.
  Order of magnitude: about ten thousand dollars (not priced to the dollar). Recent activity is RefreshReserve only (8 of 8 sampled txs).
- CanarFx: 10 owned accounts.
Conclusion: a real 1-of-10 path, but over little money. Not a headline finding on its own.

## Single-key program CBuCnLe2… (raydium-contract-instructions farm id): signer link
- Its upgrade authority 8aSRiwajnkCP3ZhWTqTGJBy82ELo3Rt1CoEk5Hyjiqiy is not a member of Raydium AMM v4's current upgrade
  multisig (tr8rgazU…, 3 of 4, read 2026-10-03).
- But 8aSRiw… itself executed Squads v3 ExecuteTransaction calls that upgraded Raydium AMM v4 (e.g. 2022-12-28 13:22:50 UTC
  slot 238,520,285 sig 5aUrJ5S6…; 2023-03-20 slot 183,639,488) and co-signed the 2022-11-14 SetAuthority (67YRh591…).
  So it was a Raydium upgrade signer then. CBuCnLe2's owner: Raydium-linked key, not confirmed as Raydium's program.
