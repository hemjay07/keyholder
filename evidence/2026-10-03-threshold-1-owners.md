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
