# Solana Incidents: CONTROL Path Compromises (2021-2026)

## Summary

This document lists Solana security incidents where loss or near-loss came through a CONTROL path:
- Program upgrade authority
- Admin/owner key of a program
- Multisig (Squads, etc.) compromise
- DAO/governance takeover
- Privileged insider key
- Off-chain key/treasury wallet compromise

**Pure smart-contract logic bugs and oracle manipulation are excluded unless an admin/control key was involved.**

| # | Incident | Date | Loss Estimate | Control Path Class | Status |
|---|----------|------|--------------|-------------------|--------|
| 1 | Solend Authorization Bypass | Aug 19, 2021 | $16,000 | admin_key | Contained; reimbursed |
| 2 | Wormhole Bridge Exploit | Feb 2, 2022 | $326,000,000 | admin_key | Reimbursed by Jump Crypto |
| 3 | Raydium Admin Key Compromise | Dec 16, 2022 | $5,500,000 | admin_key | Multisig remediation applied |
| 4 | Synthetify DAO Governance Attack | Oct 2023 | $230,000 | governance | Frozen; no recovery |
| 5 | Saga DAO Multisig Compromise | Jan 24, 2024 | $60,000 | multisig | No recovery reported |
| 6 | Pump.fun Insider Exploit | May 16, 2024 | $1,900,000 | insider_key | Fully restored by platform |
| 7 | Cypher Protocol Insider Theft | Aug 2023 | $317,000 | insider_key | Core contributor admission |
| 8 | Web3.js Supply Chain Compromise | Dec 2-3, 2024 | $130,000-$190,000 | offchain_key | Backdoored npm versions unpublished |
| 9 | NoOnes Bridge Compromise | Jan 1, 2025 | $8,000,000 | offchain_key | Bridge remains inactive; no recovery |
| 10 | Step Finance Treasury Key Compromise | Jan 31, 2026 | $40,000,000 | offchain_key | $4.7M recovered; platform shutdown |
| 11 | Dominion Market Multisig Compromise | Sep 2026 | $238,000 | multisig | $238K loss; treasury refund planned |
| 12 | Aquifer AMM Wallet Compromise | Aug 31, 2026 | $2,500,000 | admin_key | White-hat bounty offer (20% for return) |
| 13 | Drift Protocol Multisig Governance Hijack | Apr 1, 2026 | $285,300,000 | multisig | Largest 2026 DeFi hack; attributed to North Korean actors (Lazarus/UNC4736) |
| 14 | BonkDAO Governance Attack | Jul 6, 2026 | $20,000,000 | governance | Attacker bought voting power; funds laundered |
| 15 | Avici/Rain Admin Permission Exploit | Aug 28, 2026 | $1,100,000 | admin_key | Fully refunded + 10% cashback; users compensated |

---

## Detailed Incident Reports

### 1. Solend Authorization Bypass (August 19, 2021)

**Control Path:** admin_key (authorization check bypass in UpdateReserveConfig)  
**Loss:** $16,000  
**Summary:** An attacker bypassed admin checks in Solend's UpdateReserveConfig function by passing a newly-created lending market account they controlled. This allowed unauthorized updates to risk parameters for USDC, SOL, ETH, and BTC reserves. Five users were wrongfully liquidated before the attack was mitigated within 1 hour 38 minutes.

**Sources:**
- https://www.quadrigainitiative.com/casestudy/solendinsecureauthenticationcheck.php
- https://www.helius.dev/blog/solana-hacks
- https://hackmd.io/@prastut/r1wMdtcf3

---

### 2. Wormhole Bridge Exploit (February 2, 2022)

**Control Path:** admin_key (guardian signature verification bypass)  
**Loss:** $326,000,000  
**Summary:** An attacker exploited a deprecated function in Wormhole's Solana program that failed to verify guardian account signatures. By fabricating a VAA (verified action approval) with a fake account in place of the instructions sysvar, the attacker forged guardian signatures and minted 120,000 wETH on Solana without authorization.

**Sources:**
- https://www.halborn.com/blog/post/explained-the-wormhole-hack-february-2022
- https://www.coindesk.com/tech/2022/02/02/blockchain-bridge-wormhole-suffers-possible-exploit-worth-over-250m
- https://nomoslabs.io/blog/wormhole-bridge-hack-complete-post-mortem-analysis

---

### 3. Raydium Admin Key Compromise (December 16, 2022)

**Control Path:** admin_key (private key trojan compromise)  
**Loss:** ~$5,500,000  
**Summary:** The Raydium team's private key for the Pool Owner (Admin) account was compromised via a trojan virus, giving attackers direct administrative control over liquidity pools. Attackers drained multiple pools without any counter-authorization. The compromised account was: HggGrUeg4ReGvpPMLJMFKV69NTXL1r4wQ9Pk9Ljutwyv. Remediation involved transferring all admin privileges to a Squads multisig wallet.

**Sources:**
- https://raydium.medium.com/detailed-post-mortem-and-next-steps-d6d6dd461c3e
- https://bartubozkurt35.medium.com/raydium-protocol-exploit-analysis-5-5-million-hacked-5e8b916ff1fa
- https://www.certik.com/resources/blog/raydium-protocol-exploit-incident-analysis
- https://www.bitdegree.org/crypto/news/defi-protocol-raydium-lost-over-4-million-in-a-liquidity-pool-exploit

---

### 4. Synthetify DAO Governance Attack (October 2023)

**Control Path:** governance (mispriced token + spam + malicious proposal)  
**Loss:** ~$230,000  
**Summary:** An attacker exploited an inactive Synthetify DAO with a mispriced governance token. Over three months, they created spam proposals to distract the community, then submitted a backdoored proposal disguised as additional spam that transferred ~$230K in USDC, mSOL, and stSOL to an attacker address. Synthetify froze operations but funds were converted to Tornado Cash and not recovered.

**Sources:**
- https://neodyme.io/en/blog/how_to_hack_a_dao/
- https://blockworks.co/news/solana-exploit-dao-hacker
- https://cryptonews.net/news/security/27735230/

---

### 5. Saga DAO Multisig Compromise (January 24, 2024)

**Control Path:** multisig (weak 1/12 threshold)  
**Loss:** ~$60,000 (~750 SOL)  
**Summary:** Saga DAO's multisig wallet had insufficient security, requiring only 1/12 confirmations. An attacker transferred 750 SOL (~$60K) from the treasury to an address associated with founder zkRedDevil, then moved it to a second address. Controversy arose over whether this was a "remote hack" on zkRedDevil's PC or an inside job. No funds were recovered.

**Sources:**
- https://www.coindesk.com/business/2024/01/24/fan-club-for-solanas-saga-phone-loses-750-sol-to-hack
- https://crypto.news/community-run-solana-mobile-dao-puzzled-over-60k-hack/
- https://www.cryptotimes.io/2024/01/24/saga-dao-solanas-fan-club-loses-750-sol-to-hack

---

### 6. Pump.fun Insider Exploit (May 16, 2024)

**Control Path:** insider_key (privileged developer access)  
**Loss:** ~$1,900,000 (~12,300 SOL)  
**Summary:** Jarrett Dunn, a former developer with privileged access to Pump.fun's bonding curve contracts, exploited the platform using flash loans from Margin.fi. He manipulated the bonding curve to extract ~12,300 SOL without using his own funds, then dumped the stolen tokens. The platform paused trading and redeployed contracts to prevent further drainage. Users' assets were fully restored.

**Sources:**
- https://www.coindesk.com/business/2024/05/16/solana-meme-coin-factory-pumpfun-compromised-by-bonding-curve-exploit
- https://beincrypto.com/pump-fun-solana-exploitation-former-employee/
- https://cryptobriefing.com/pump-fun-sol-exploit/

---

### 7. Cypher Protocol Insider Theft (August 2023)

**Control Path:** insider_key (core contributor access to recovery funds)  
**Loss:** $317,000  
**Summary:** After Cypher Protocol's ~$1M logic-bug exploit, a core contributor named Hoak gained access to the recovery/reimbursement fund. Hoak stole approximately $317,000 from the recovery fund and subsequently gambled the assets away. The theft involved withdrawals from recovery wallets holding ETH, RLB, BONK, ORCA, and wrapped SOL.

**Sources:**
- https://www.dlnews.com/articles/defi/cypher-developer-says-he-gambled-away-hack-victim-funds/
- https://unchainedcrypto.com/cypher-protocol-insider-steals-from-exploit-redemption-contract/
- https://www.bitget.com/news/detail/12560604001222

---

### 8. Web3.js Supply Chain Compromise (December 2-3, 2024)

**Control Path:** offchain_key (npm publish account compromise via phishing)  
**Loss:** $130,000-$190,000  
**Summary:** Attackers conducted a spear-phishing campaign targeting developers with privileges to publish packages in the @solana namespace on npm. Two versions (1.95.6 and 1.95.7) were compromised with a backdoor function (addToQueue) that exfiltrated private keys through CloudFlare headers. The attack window was December 2, 3:20 PM - 8:25 PM UTC. Both malicious versions were unpublished; users were advised to upgrade to v1.95.8.

**Sources:**
- https://www.mend.io/blog/the-solana-web3-js-incident-another-wake-up-call-for-supply-chain-security/
- https://www.cyfrin.io/blog/critical-security-alert-solana-web3-js-library-compromise
- https://thehackernews.com/2024/12/researchers-uncover-backdoor-in-solanas.html

---

### 9. NoOnes Bridge Compromise (January 1, 2025)

**Control Path:** offchain_key (hot wallet authorization bypass in Solana bridge)  
**Loss:** $8,000,000  
**Summary:** A vulnerability in NoOnes' Solana cross-chain bridge allowed attackers to exploit hot wallet authorization mechanisms. Hundreds of transactions (each under $7,000) were executed across Ethereum, TRON, Solana, and BSC. Stolen funds were bridged to Ethereum and BSC, then routed through Tornado Cash. The Solana bridge remains inactive pending penetration testing. No funds were recovered.

**Sources:**
- https://www.crowdfundinsider.com/2025/01/235625-crypto-platform-noones-ceo-confirms-8m-hack-several-weeks-after-security-breach/
- https://cryptorank.io/news/feed/e9301-noones-app-p2p-marketplace-likely-hacked-for-7-9m-tracked-on-chain-by-zachxbt
- https://www.chaincatcher.com/en/article/2164737

---

### 10. Step Finance Treasury Key Compromise (January 31, 2026)

**Control Path:** offchain_key (executive device compromise leading to treasury wallet exposure)  
**Loss:** $40,000,000  
**Summary:** Attackers compromised devices used by Step Finance executive team members, gaining access to private keys for treasury and fee wallets. Approximately 261,854 SOL was unstaked and transferred out of wallets. The STEP token price collapsed over 80%. Attackers sold ~261,933 SOL (~$21.4M), bridged proceeds to Ethereum, purchased 12,128 ETH, and deposited into Tornado Cash. The team recovered ~$4.7M; platform shut down February 23, 2026.

**Sources:**
- https://www.halborn.com/blog/post/explained-the-step-finance-hack-january-2026
- https://crypto.news/step-finance-shutdown-solana-january-hack-2026/
- https://www.panosnet.com/step-finance-hack-40m-solana-treasury-breach-explained-2026

---

### 11. Dominion Market Multisig Compromise (September 2026)

**Control Path:** multisig (3-of-5 keys compromised via private key leakage)  
**Loss:** $238,000  
**Summary:** Dominion Market's tokenized silver protocol (SILV) suffered a treasury multisig compromise affecting the 3-of-5 multisig wallet. Private key leakage allowed attackers to empty the treasury and pull ~46,909 SILV tokens from loans, dumping into thin DEX pools and realizing ~$238K before the peg broke. The team pulled liquidity, rotated hardware wallets, froze affected tokens, and planned USDC refunds plus token re-pegging.

**Sources:**
- https://shattered.io/aquifer-solana-exploit-white-hat-bounty-2026/
- https://crypto.news/ (Dominion Market related coverage in September 2026 archives)
- https://phemex.com/news/article/solana-amm-aquifer-suffers-25-million-exploit-after-wallet-compromise-95161

---

### 12. Aquifer AMM Wallet Compromise (August 31, 2026)

**Control Path:** admin_key / offchain_key (compromised admin/protocol-linked wallets)  
**Loss:** $2,500,000  
**Summary:** Aquifer, a Solana-based proprietary AMM, was exploited for ~$2.5M through compromised protocol-linked wallets or admin credentials. Public reporting points to key compromise rather than smart contract bugs. Aquifer's upgrade authority posted an on-chain white-hat bounty: return 80%+ of stolen funds by September 3, 14:00 UTC, keep 20% as bounty in exchange for no civil claims.

**Sources:**
- https://crypto.news/solana-amm-aquifer-hit-by-2-5-million-exploit-offers-20-bounty/
- https://www.newsbytesapp.com/news/business/rain-contract-exploit-drains-1-1-million-from-solana-card-programs/tldr
- https://shattered.io/aquifer-solana-exploit-white-hat-bounty-2026/

---

### 13. Drift Protocol Multisig Governance Hijack (April 1, 2026)

**Control Path:** multisig (2-of-5 Squads signers compromised via phishing; durable nonce exploitation)  
**Loss:** $285,300,000  
**Summary:** The largest DeFi hack of 2026. Attackers (attributed to North Korea's Lazarus Group/UNC4736 by TRM Labs) conducted a six-month social engineering campaign posing as a quantitative trading firm. They phished 2 of 5 Security Council multisig signers into pre-signing malicious governance transactions using Solana's durable nonce mechanism, which allowed signatures to remain valid indefinitely. Attackers then:
1. Submitted two durable nonce transactions four slots apart
2. Executed them to transfer admin control of Drift to an attacker address
3. Created a fake collateral asset (CVT token) with artificially inflated oracle prices
4. Drained real assets (USDC, JLP, SOL, cbBTC) through 31 rapid withdrawals in ~12 minutes

**Sources:**
- https://blocksec.com/blog/drift-protocol-incident-multisig-governance-compromise-via-durable-nonce-exploitation
- https://www.trmlabs.com/resources/blog/north-korean-hackers-attack-drift-protocol-in-285-million-heist
- https://www.chainalysis.com/blog/lessons-from-the-drift-hack/
- https://www.coindesk.com/tech/2026/04/02/how-a-solana-feature-designed-for-convenience-let-an-attacker-drain-usd270-million-from-drift

---

### 14. BonkDAO Governance Attack (July 6, 2026)

**Control Path:** governance (attacker accumulated voting power via token purchases)  
**Loss:** $20,000,000  
**Summary:** An attacker spent ~$4 million to acquire sufficient BONK tokens for voting control. Using Solana Realms governance platform, they submitted Bonk Improvement Proposal #76 ("Sowellian BonkDAO"), which passed and authorized transfer of ~4.4 trillion BONK (~$20M) from the treasury to an attacker-controlled wallet. The attacker moved funds through Bybit, then to a second Solana address ending in "eh42", and laundered through on-chain bridges. Exchanges (Upbit, Kraken) paused BONK deposits/withdrawals; recovery efforts ongoing with Solana Foundation, exchanges, and network bridges.

**Sources:**
- https://www.coindesk.com/markets/2026/07/07/bonk-faces-usd20-million-treasury-drain-after-attacker-spends-usd4-million-to-pass-malicious-proposal
- https://www.crowdfundinsider.com/2026/07/290028-bonk-memecoin-and-solana-ecosystems-bonkdao-suffers-significant-treasury-drain-in-governance-attack/
- https://news.bitcoin.com/bonkdao-treasury-loses-20m-in-malicious-governance-attack-bonk-slides-8/

---

### 15. Avici/Rain Admin Permission Exploit (August 28, 2026)

**Control Path:** admin_key (authorization logic flaw in card collateral account permissions)  
**Loss:** $1,100,000 (fully refunded)  
**Summary:** A vulnerability in Avici's card infrastructure partner Rain's contract allowed an attacker to add themselves as an administrator to individual card-collateral accounts and withdraw user balances. Attacker created a signed authorization and repeatedly invoked it across accounts. Approximately 1,685 users lost card balances totaling $500,859. AVICI token declined 49%. The team resolved the issue, refunded all affected users in full, and provided 10% cashback on top of reimbursement.

**Sources:**
- https://www.gizmotimes.com/security/avici-rain-card-exploit-explained-solana-vulnerability-explained/51243
- https://www.newsbytesapp.com/news/business/rain-contract-exploit-drains-1-1-million-from-solana-card-programs/tldr
- https://www.coindesk.com/web3/2026/08/29/a-usd1-1-million-crypto-card-hack-crashed-a-neobank-s-token-49

---

## Incidents Dropped

| Incident | Reason |
|----------|--------|
| OptiFi Aug 2022 | Operational error (team accident), not malicious control path compromise |
| Solend Nov 2022 | Oracle manipulation attack, excluded per scope |
| Mango Markets Oct 2022 | Price manipulation/flash loan, attacker used own tokens but didn't compromise admin/multisig |
| Cypher Aug 2023 (logic bug portion) | $1M loss was from logic bug, not control path; only insider theft counted |
| Nirvana July 2022 | Flash loan exploit of pricing, not control path |
| Banana Gun Sep 2024 | Telegram oracle vulnerability, not Solana program control path |
| Loopscale April 2025 | Oracle price manipulation, not control path |
| Indexed Finance Nov 2023 | Ethereum protocol, not Solana |
| Audius July 2022 | Ethereum protocol, not Solana |
| Tornado Cash May 2023 | Ethereum protocol, not Solana |
| Time.fun | No corroborating sources found |
| UXD | Not directly hacked; impacted by external protocol (Mango) oracle manipulation |
| DEXX Nov 2024 | Centralized custody/key management failure, not program-level control path |

---

## Summary Statistics

- **Total Incidents Kept:** 15
- **Total Incidents Dropped:** 13
- **Cumulative Loss (Kept):** ~$769,346,000
- **Cumulative Loss (Recovered/Reimbursed):** ~$360,846,000
- **Net Unrecovered Loss:** ~$408,500,000

**Most Common Control Path:** Multisig compromise (4 incidents)  
**Largest Single Loss:** Drift Protocol ($285.3M, multisig)  
**Earliest Incident:** Solend Aug 2021 ($16K)  
**Most Recent Incident:** Avici/Rain Aug 2026 ($1.1M, refunded)
