# KeyBench record for BonkDAO BIP #76 (Jul 2026), from chain reads. Run: python3 bonkdao.py
from rpc import *
import json
P = "6wR1jdhhJ31bbdRNXva8MxqsgsNLKTxargcdAyZ7FcRj"; REALM = "84pGFuy1Y27ApK67ApethaPvexeDWA66zNV8gm38TVeQ"
ss = list(reversed(sigs(P)))
def full(prefix): return next(x for x in ss if x['signature'].startswith(prefix))
create, drain = full("3bvjf8Xma3QCbp4PJpKS8w"), full("5tPU1srcRcnmibB7KJi2WQ")
t = tx(drain['signature'])
moves = []
pre = {b['accountIndex']: b for b in t['meta']['preTokenBalances']}
for b in t['meta']['postTokenBalances']:
    a = pre.get(b['accountIndex']); d = int(b['uiTokenAmount']['amount']) - (int(a['uiTokenAmount']['amount']) if a else 0)
    if d: moves.append({"owner": b.get('owner'), "mint": b['mint'], "raw_delta": d, "decimals": b['uiTokenAmount']['decimals']})
_, pdata = acct(P); gov = b58(pdata[1:33])
proposer = [k['pubkey'] for k in tx(create['signature'])['transaction']['message']['accountKeys'] if k.get('signer')][0]
inc = {
 "id": "bonkdao-2026", "name": "BonkDAO BIP #76 (Jul 2026)", "class": "governance_treasury",
 "sources": ["https://www.coindesk.com/markets/2026/07/07/bonk-faces-usd20-million-treasury-drain-after-attacker-spends-usd4-million-to-pass-malicious-proposal", "https://news.bitcoin.com/bonkdao-treasury-loses-20m-in-malicious-governance-attack-bonk-slides-8/"],
 "realm": REALM, "realm_name_on_chain": "Bonk DAO", "governance": gov, "proposal": P, "proposal_name_on_chain": "BIP # 76 - Sowellian BonkDAO", "proposer": proposer,
 "events": [
  {"kind": "treasury_proposal_created", "what": "CreateProposal + 4 InsertInstruction + SignOff", "sig": create['signature'], "slot": create['slot'], "time": utc(create['blockTime'])},
  {"kind": "first_loss", "what": "ExecuteTransaction: treasury BONK transfer", "sig": drain['signature'], "slot": drain['slot'], "time": utc(drain['blockTime'])}],
 "votes": [{"sig": x['signature'], "time": utc(x['blockTime'])} for x in ss if x['slot'] > create['slot'] and x['slot'] < drain['slot']],
 "moves": moves, "read_at": "2026-10-03", "rpc": RPC}
json.dump(inc, open('/Users/mujeeb/controlplane/data/keybench/bonkdao-2026.json', 'w'), indent=1)
print(gov, proposer); print(moves)
