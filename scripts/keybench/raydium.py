# KeyBench record for Raydium AMM v4 (Dec 2022), from chain reads. Run: python3 raydium.py
from rpc import *
import json, time
P = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"; PD = "A7ZG7ByDi8DpzT9Ab7CiXhvgYTJQmaDPJkMDoPitaCQV"; ADMIN = "HggGrUeg4ReGvpPMLJMFKV69NTXL1r4wQ9Pk9Ljutwyv"
def gettx(s):
    for _ in range(6):
        t = tx(s)
        if t: return t
        time.sleep(3)
pd_sigs = list(reversed(all_sigs(PD)))
def find(prefix): return next(x for x in pd_sigs if x['signature'].startswith(prefix))
setauth = gettx(find("67YRh5912fzsC8ZUGPvpFvi9")['signature']); fix = gettx(find("2x5qod9EVQqSVkKevZz9kPyF")['signature'])
setauth_logs = [l for l in setauth['meta']['logMessages']]
new_auth = [k['pubkey'] for k in setauth['transaction']['message']['accountKeys']]
# admin key activity in the attack window (Dec 2022)
adm = all_sigs(ADMIN, cap=3000)
dec = [x for x in adm if x.get('blockTime') and 1669852800 <= x['blockTime'] < 1672531200]
dec.sort(key=lambda x: x['slot'])
first, last = dec[0], dec[-1]
inc = {
 "id": "raydium-2022", "name": "Raydium AMM v4 (Dec 2022)", "class": "admin_key",
 "sources": ["https://raydium.medium.com (post-mortem, Dec 2022) - see LEADS.md", "https://www.certik.com (incident analysis) - see LEADS.md"],
 "program": P, "programdata": PD, "admin_key": ADMIN, "admin_key_on_curve": on_curve(ADMIN),
 "upgrade_authority_at_attack": "Squads v3 multisig vault (set 2022-11-14, a month before)",
 "notes": "The stolen key is the AMM's admin key compiled into the program, not the upgrade authority. The upgrade authority was already a Squads v3 multisig.",
 "events": [
  {"kind": "upgrade_authority_set", "what": "SetAuthority on programdata (signers below)", "sig": setauth['transaction']['signatures'][0], "slot": setauth['slot'], "time": utc(setauth['blockTime']), "accounts": new_auth},
  {"kind": "first_loss", "what": "first admin-key tx of the attack window (Dec 2022)", "sig": first['signature'], "slot": first['slot'], "time": utc(first['blockTime'])},
  {"kind": "last_admin_tx", "what": "last admin-key tx in Dec 2022", "sig": last['signature'], "slot": last['slot'], "time": utc(last['blockTime'])},
  {"kind": "fix_upgrade", "what": "Squads ExecuteTransaction -> upgrade of " + P, "sig": fix['transaction']['signatures'][0], "slot": fix['slot'], "time": utc(fix['blockTime'])}],
 "admin_txs_dec_2022": len(dec), "read_at": "2026-10-03", "rpc": RPC}
json.dump(inc, open('/Users/mujeeb/controlplane/data/keybench/raydium-2022.json', 'w'), indent=1)
print(json.dumps(inc['events'], indent=1)[:2000]); print('admin txs', len(dec), 'on_curve', inc['admin_key_on_curve'])
