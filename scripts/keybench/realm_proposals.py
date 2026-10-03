# List every proposal under a Realms DAO with on-chain name, creation and last-activity time.
# Run: python3 realm_proposals.py <realm> [since YYYY-MM-DD]
import sys, re, json
from rpc import *
G = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
realm = sys.argv[1]; since = sys.argv[2] if len(sys.argv) > 2 else "0000"
govs = [g for g in call("getProgramAccounts", [G, {"encoding": "base64", "dataSlice": {"offset": 0, "length": 1}, "filters": [{"memcmp": {"offset": 1, "bytes": realm}}]}]) if base64.b64decode(g['account']['data'][0])[0] in (18, 19, 20, 21, 25, 26)]
rows = []
for g in govs:
    ps = call("getProgramAccounts", [G, {"encoding": "base64", "filters": [{"memcmp": {"offset": 1, "bytes": g['pubkey']}}]}])
    for p in ps:
        d = base64.b64decode(p['account']['data'][0])
        if d[0] != 14: continue
        s = sigs(p['pubkey'])
        if not s: continue
        first, last = s[-1], s[0]
        if utc(last['blockTime']) < since: continue
        txt = [n.decode(errors='replace') for n in re.findall(rb'[\x20-\x7e]{6,}', d)]
        rows.append({"governance": g['pubkey'], "proposal": p['pubkey'], "created": utc(first['blockTime']), "last": utc(last['blockTime']), "sigs": len(s), "text": txt[:3]})
rows.sort(key=lambda r: r['created'])
for r in rows: print(r['created'], '→', r['last'], r['proposal'], r['governance'][:8], r['sigs'], r['text'][:2])
json.dump(rows, open(f"/private/tmp/claude-501/-Users-mujeeb/bad9c17e-6eb6-4eda-9460-73c07a1e3d56/scratchpad/props-{realm[:8]}.json", "w"), indent=1)
