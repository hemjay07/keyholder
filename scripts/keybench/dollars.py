# Dollar coverage, lower bound (design/MOAT-BUILD.md, B).
# For each program: read its recent transactions; a token account is "held by the program" when
# tokens left it inside a transaction that invoked the program, and its authority (token-account owner)
# is either an account owned by the program or an address with no account at all (a PDA).
# Each held vault's CURRENT balance is priced via Jupiter; a mint counts only if its Jupiter liquidity
# is >= LIQ_FLOOR (junk tokens with paper prices are excluded). The total is a floor, not the program's TVL.
# Run: python3 dollars.py <coverage-json> <out-json> [tx_per_program]
import json, sys, time, urllib.request
from rpc import call, acct, sigs, tx, utc, on_curve

LIQ_FLOOR = 100_000
# programs whose reserves follow the Kamino-lending layout (checked per run: every vault's mint must match)
LAYOUT_KLEND = {'KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD', 'SLendK7ySfcEzyaFqy93gDnD3RtrpXJcnRwb6zFHJSh'}
cov_path, out_path = sys.argv[1], sys.argv[2]
N = int(sys.argv[3]) if len(sys.argv) > 3 else 60
programs = json.load(open(cov_path))['programs']

def gettx(sig):
    for _ in range(5):
        t = tx(sig)
        if t: return t
        time.sleep(2)
    return None

owner_cache = {}
def owner_of(addr):
    if addr not in owner_cache:
        v = call("getAccountInfo", [addr, {"encoding": "base64", "dataSlice": {"offset": 0, "length": 0}}])["value"]
        owner_cache[addr] = v["owner"] if v else None
    return owner_cache[addr]

TOKEN_PROGRAMS = {"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"}

def transfer_callers(t):
    """Source token account -> set of programs that made the token CPI moving out of it.
    Built by pairing token-program invocations in the logs (with their caller from the invoke stack)
    with token instructions in innerInstructions, which run in the same order. None if they don't line up."""
    stack, callers = [], []
    for l in t['meta'].get('logMessages') or []:
        parts = l.split()
        if len(parts) == 4 and parts[0] == 'Program' and parts[2] == 'invoke':
            d = int(parts[3].strip('[]')); del stack[d - 1:]; stack.append(parts[1])
            if parts[1] in TOKEN_PROGRAMS and d > 1: callers.append(stack[d - 2])
    inner = [ix for g in sorted(t['meta'].get('innerInstructions') or [], key=lambda g: g['index']) for ix in g['instructions'] if ix.get('programId') in TOKEN_PROGRAMS]
    if len(inner) != len(callers): return None
    out = {}
    for ix, c in zip(inner, callers):
        info = (ix.get('parsed') or {}).get('info') or {}
        if (ix.get('parsed') or {}).get('type') in ('transfer', 'transferChecked', 'burn', 'burnChecked') and info.get('source', info.get('account')):
            out.setdefault(info.get('source', info.get('account')), set()).add(c)
    return out

def vaults_for(pid):
    found = {}
    for s in sigs(pid, limit=N):
        if s.get('err'): continue
        t = gettx(s['signature'])
        if not t or t['meta']['err']: continue
        keys = [k['pubkey'] for k in t['transaction']['message']['accountKeys']]
        signers = {k['pubkey'] for k in t['transaction']['message']['accountKeys'] if k.get('signer')}
        moved_by = transfer_callers(t)
        if moved_by is None: continue
        post = {b['accountIndex']: b for b in t['meta'].get('postTokenBalances', [])}
        for b in t['meta'].get('preTokenBalances', []):
            a = post.get(b['accountIndex'])
            if not a: continue
            if float(a['uiTokenAmount']['uiAmountString'] or 0) >= float(b['uiTokenAmount']['uiAmountString'] or 0): continue
            auth = b.get('owner')
            if not auth or auth in signers: continue
            if pid not in moved_by.get(keys[b['accountIndex']], ()): continue
            o = owner_of(auth)
            if o == pid or o is None or (o == '11111111111111111111111111111111' and not on_curve(auth)):
                found[keys[b['accountIndex']]] = {"mint": b['mint'], "authority": auth, "authority_owner": o, "seen_in": s['signature']}
        time.sleep(0.2)
    return found

def klend_reserves(pid):
    """Kamino-lending layout (8624-byte Reserve): mint at 128, supply vault at 160, both checked against
    the vault's own token account (offsets verified on SLendK7y, evidence/2026-10-03-threshold-1-owners.md)."""
    from rpc import b58
    import base64
    accts = call("getProgramAccounts", [pid, {"encoding": "base64", "dataSlice": {"offset": 128, "length": 64}, "filters": [{"dataSize": 8624}]}])
    found = {}
    for a in accts:
        d = base64.b64decode(a['account']['data'][0])
        found[b58(d[32:64])] = {"mint": b58(d[0:32]), "authority": None, "authority_owner": pid, "seen_in": "reserve " + a['pubkey']}
    return found

def balances(vaults):
    addrs = list(vaults)
    for i in range(0, len(addrs), 100):
        vs = call("getMultipleAccounts", [addrs[i:i + 100], {"encoding": "jsonParsed"}])["value"]
        for a, v in zip(addrs[i:i + 100], vs):
            try:
                info = v['data']['parsed']['info']
                # a layout-derived vault must hold the mint its reserve names; otherwise it is not counted
                vaults[a]["amount"] = float(info['tokenAmount']['uiAmountString']) if info['mint'] == vaults[a]['mint'] else 0.0
            except Exception: vaults[a]["amount"] = 0.0

def prices(mints):
    out = {}
    ms = list(mints)
    for i in range(0, len(ms), 50):
        r = json.load(urllib.request.urlopen(urllib.request.Request("https://lite-api.jup.ag/price/v3?ids=" + ",".join(ms[i:i + 50]), headers={"User-Agent": "curl/8.7.1"}), timeout=60))
        out.update(r)
        time.sleep(1)
    return out

result = {"method": __doc__ if False else "lower bound from recent-tx vault discovery; see header", "tx_per_program": N, "liq_floor_usd": LIQ_FLOOR, "programs": []}
for p in programs:
    try:
        v = vaults_for(p['programId'])
        if p['programId'] in LAYOUT_KLEND: v.update(klend_reserves(p['programId']))
        balances(v)
        result["programs"].append({**{k: p.get(k) for k in ("programId", "upgradeAuthority", "authorityKind")}, "multisig": p.get("multisig"), "vaults": v})
        print(p['programId'][:8], p['authorityKind'], 'vaults', len(v), flush=True)
    except Exception as e:
        result["programs"].append({"programId": p['programId'], "authorityKind": p.get('authorityKind'), "error": str(e)})
        print(p['programId'][:8], 'ERROR', e, flush=True)
mints = {x["mint"] for p in result["programs"] for x in p.get("vaults", {}).values()}
px = prices(mints)
result["priced_at"] = utc(time.time()); result["prices"] = {m: {"usd": px[m]["usdPrice"], "liquidity": px[m].get("liquidity")} for m in px}
for p in result["programs"]:
    usd = 0.0
    for x in p.get("vaults", {}).values():
        q = px.get(x["mint"])
        x["usd"] = round(x["amount"] * q["usdPrice"], 2) if q and (q.get("liquidity") or 0) >= LIQ_FLOOR else None
        usd += x["usd"] or 0
    p["usd_floor"] = round(usd, 2)
json.dump(result, open(out_path, "w"), indent=1)
print("TOTAL", round(sum(p.get("usd_floor", 0) for p in result["programs"]), 2))
