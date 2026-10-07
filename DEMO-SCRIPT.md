# Keyholder demo: 2 min 30 s, recorded on the live site

Browser at 1440 wide, one tab per scene opened in advance. Say the bold lines; the rest is what to do.

## 1. The number (0:00–0:25) · https://keyholder-ashy.vercel.app/keybench
Scroll to "Today: $769M can move with no delay".
- **"Solana programs hold billions, and someone can upgrade every one of them. We traced $2.66 billion to the vaults of the largest programs. $769 million of it sits behind multisigs that can change the code with no waiting period."**
- Hover the first row (675kPX9M…, 3 of 4, $573M). **"This is Raydium's main AMM: three of four keys, no timelock, half a billion dollars."**

## 2. Drift, replayed (0:25–1:10) · https://keyholder-ashy.vercel.app/replay/drift
Press play, or step through.
- **"In April, Drift lost $285 million. The attacker didn't break the code; they took over the keys."**
- At the new-multisig step: **"Five and a half days before the first drain, a second multisig appeared, set up by the same controller. Keyholder's rules flag that the moment it lands on chain."**
- At the drain: **"Every step here is a real transaction. Click any of them and you're on the explorer."**

## 3. KeyBench (1:10–1:45) · back to /keybench, scroll the incidents
- **"We didn't stop at Drift. KeyBench replays every Solana loss that came through a control key and asks: would Keyholder have warned, and how early?"**
- Point at Synthetify and BonkDAO: **"These two were governance attacks: a proposal sat on chain for six to eight days before the money moved. The rule that catches them was written after we studied them, and the page says so."**
- Point at Raydium: **"And where we would have missed, the miss stays on the page."**

## 4. The check (1:45–2:15) · https://keyholder-ashy.vercel.app/policy
- **"Alerts are for people. The check is for programs: a vault calls Keyholder on chain before it moves money."**
- Show the refused deposit, then set a policy in the simulator (for example, at least 3 signers and a 24 h timelock): **"Set your policy, and deposits into a protocol below it are refused."**

## 5. Close (2:15–2:30) · stay on /policy or return to /keybench
- **"Every day, Keyholder records who controls every program it covers, and posts a hash of that record on chain, so no one can rewrite what control looked like on any given day. Keyholder: know who can move the money."**

## Before recording
- Each URL above returns 200 (checked 2026-10-07).
- Numbers on the pages come from data files; if they are regenerated before recording, re-read scene 1's figures off the page.
