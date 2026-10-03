# KeyBench record for Synthetify (Oct 2023), built only from chain reads. Run: python3 synthetify.py
from rpc import *
import json, time
P = "5TeGDBaMNPc2uxvx6YLDycsoxFnBuqierPt3a8Bk4xFX"
UP = "35oqavmhfo4QMdbxFSz4hYQXqY9bW1S5Ygj4sXMon2cd6cZCj6w1ovhzKqg2tEszpi3hjV62k8p9xgYXea52H7Z"
DRAINER = "BvvMMoT8"
def gettx(sig):
    for i in range(6):
        t = tx(sig)
        if t: return t
        time.sleep(3)
    raise RuntimeError("tx not returned: " + sig)
s = list(reversed(sigs(P, until=UP)))
drain, tot, vault_owner, drainer = [], {}, None, None
for x in s[:80]:
    t = gettx(x['signature'])
    if t['meta']['err']: continue
    signer = [k['pubkey'] for k in t['transaction']['message']['accountKeys'] if k.get('signer')]
    if not signer[0].startswith(DRAINER): continue
    drainer = signer[0]
    pre = {b['accountIndex']: b for b in t['meta'].get('preTokenBalances', [])}
    moved = False
    for b in t['meta'].get('postTokenBalances', []):
        a = pre.get(b['accountIndex'])
        d = float(b['uiTokenAmount']['uiAmountString'] or 0) - (float(a['uiTokenAmount']['uiAmountString'] or 0) if a else 0)
        if d > 0 and b.get('owner') == drainer: tot[b['mint']] = tot.get(b['mint'], 0) + d; moved = True
        if d < 0: vault_owner = b.get('owner')
    if moved: drain.append({"sig": x['signature'], "slot": t['slot'], "time": utc(t['blockTime'])})
inc = {
 "id": "synthetify-2023", "name": "Synthetify (Oct 2023)", "class": "governance_upgrade",
 "sources": ["https://blockworks.co/news/solana-exploit-dao-hacker", "https://neodyme.io/en/blog/how_to_hack_a_dao"],
 "program": P, "realm": "7oB84bSuxv9AH1iRdMp5nFLwpQApv8Yo9s1gGmDkHtSP", "realm_name_on_chain": "Synthetify",
 "governance": "Aijh3RvCTyxcxi3BXaNj9qSQkXXsGnHAmywuQBC2YSv4", "governance_kind": "spl-governance 3.1.1 program governance over " + P,
 "community_mint": "4dmKkXNHdgYsXqBHCuMikNQWwVomZURhYvkkX5c4pQ7y",
 "attack_proposal": "5ma5FMHZHWVrfZMQYsooqS584PtCiXPcuZ1QBbvK93aH", "proposal_name_on_chain": "SNY Airdrop ✅ on Terra 2.0",
 "proposer": "mBC9a2h2r9Hxtye59vw8tau5WfcVye2SdJsUREZXfki", "voter_executor": "Hfo6NHDUCyz3LcLDkHXqrVdvo3UCYfYTbQkPvw3D8jqp",
 "drainer": drainer, "vault_owner": vault_owner,
 "events": [
  {"kind": "upgrade_proposal_created", "what": "CreateProposal + InsertInstruction (program upgrade, hold_up 86400 s) + SignOffProposal", "sig": "3rLEAWpHrWvv1oPH4kdLTiGz3mnmDKhfBS7C4QBpiijcCAv4wJUbLnkwYN9dZ3Vy3PrD73J4kowM4KDrU5qmyfjj", "sig2": "3sEizcsoNhiw3UAtjyopk3Qq7EhwxLnZPR6YeP6FXTjeHbNahJw47AVM2zDtYmQoPWqoDeSA7gs1BMgPzuawoZkS", "slot": 222520471, "time": "2023-10-09 08:42:35"},
  {"kind": "vote_cast", "what": "CastVote Approve", "sig": "4xNzQsFtRzjxrVxx5sFaiR2gWQ5L2u4iub92wXHGz7Jwq8iYR3DMcMYQ1yLMudiiD8jdXZ4FGeyPteNzEa6Kvf2r", "slot": 223906221, "time": "2023-10-15 22:39:19"},
  {"kind": "vote_finalized", "what": "FinalizeVote", "sig": "RnfUwMz1pXzSjZwQb3ZLSKBqBQ9xoj2kVSHfthHjTXXmADXhFzV6dTDPeugGnLenYc46WGNn3xhxTqeG1o9CJmz", "slot": 224196944, "time": "2023-10-17 07:50:52"},
  {"kind": "program_upgraded", "what": "ExecuteTransaction -> Upgraded program " + P, "sig": UP, "slot": 224209718, "time": "2023-10-17 09:19:06"},
  {"kind": "first_loss", "what": "first transfer out of the program vault to the drainer", "sig": drain[0]['sig'], "slot": drain[0]['slot'], "time": drain[0]['time']}],
 "drain_txs": drain, "drained_by_mint": tot, "read_at": "2026-10-03", "rpc": RPC}
json.dump(inc, open('/Users/mujeeb/controlplane/data/keybench/synthetify-2023.json', 'w'), indent=1, ensure_ascii=False)
print(len(drain), 'drain txs; drainer', drainer, 'vault owner', vault_owner); print({k: round(v, 2) for k, v in tot.items()})
