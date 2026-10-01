# Technical demo: voice-over script (≤ 3:00)

Your words to adapt; say them in your own voice. Times are for the films; the live-site parts have no fixed timing. Every fact below was checked against chain or code on 2026-09-27 (sources at the end). About 130–150 words per minute; this script is about 420 words.

## 0:00–0:15 · architecture.mp4 (the map)
"This is the technical demo of Keyholder. One control change, followed from the chain, to an alert, to a refusal on-chain. A worker reads Solana, decodes control changes, writes a record, and sends signed alerts. And a Solana program lets a vault refuse deposits by itself."

## 0:15–1:21 · anatomy.mp4 (66 s)
**Record (film 0:03–0:22)**
"Start with Marinade on mainnet. We don't trust an address from a docs page. From the program id we derive its ProgramData account, and read the upgrade authority out of its bytes. That authority has no account of its own: it's a signer derived from a coral multisig, with nonce 253. We read that multisig's bytes directly: thirteen owners, threshold six, and coral has no timelock field at all. So Marinade is six of thirteen, with no timelock feature. The worker re-reads this every ten minutes, and if a read fails, it writes nothing, so a flaky RPC can never look like a control change."

**Alert (film 0:22–0:39)**
"Now a change. On devnet, this Squads transaction lowers a multisig from three of five to two of five, and its timelock from ten seconds to zero. Keyholder's rules are about control, not price: threshold lowered, timelock reduced, no timelock. The alert goes out as a webhook signed with HMAC, so the receiver can verify it came from us. On Drift, the same kind of alert would have fired on the 25th of March, five point six days before the money moved."

**Refuse (film 0:39–1:06)**
"This is the part that matters: the check runs inside the vault's own transaction. Before taking a deposit, the vault calls Keyholder by CPI. The program re-reads the protocol's ProgramData live, re-reads its multisig live, and checks the upgrade authority still derives from it: for Squads v4 vaults, Squads v3 and coral. Then it compares with the vault's own policy: minimum threshold, minimum timelock, and cooldowns after a weakening or an upgrade. Here the policy asked for three keys and ten seconds. After the change it's two keys and zero, so the check fails with ThresholdBelowPolicy, error 6001, and the deposit reverts. There's no server in that path. The answer is chain state."

## 1:21–2:30 · live site + Explorer (shot list rows 2–11)
"Here it is live." Show /protocols/marinade ("checked N minutes ago"), /alerts (the real first Drift alert body), /policy (the proof strip, then Try your own policy), then the three devnet transactions on Solana Explorer: the pass, the weakening, and the refusal showing Custom 6001.

## 2:30–2:50 · decisions
"Three decisions. We read authority from chain, never from a list, so it can't go stale. We support Squads v4, v3 and coral multisigs today; Realms governance is refused as unknown until we read it properly. And Keyholder holds itself to its own rule: its program is controlled by a Squads multisig, two of three, with a 48-hour timelock."

## 2:50–3:00 · what's next
"It runs on devnet today; mainnet is next, then Realms. Keyholder: count the keys."

## Sources (checked 2026-09-27)
- Marinade chain: live mainnet reads at slot 451,020,617 (programdata 4PQH9Y…cWMSBf, authority 551FBX…yzBp = create_program_address([magrsH…T9Wed, 253], msigmt…g6Xdt), 13 owners, threshold 6).
- Devnet transactions: getTransaction on api.devnet.solana.com; the refusal returns InstructionError Custom 6001.
- Policy: scripts/demo-threshold-flip.ts (minThreshold 3, minTimeLock 10 s).
- The check: programs/keyholder/src/lib.rs `check()` (live ProgramData read, live multisig read, policy comparison, first reason → error).
- Rules: packages/risk/src/rules.ts. Own control: /policy (Squads v4, 2 of 3, 48 h).
