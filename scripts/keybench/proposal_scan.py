# Out-of-sample check for control_proposal_pending (design/keybench/KEYBENCH.md): how often would it fire on
# ordinary governance? For each realm: every proposal, its ProposalTransaction accounts (type 13), decoded and
# classified exactly as packages/decoder/src/spl-gov-decoder.ts does (loader Upgrade -> program_upgrade,
# loader SetAuthority -> set_authority, token Transfer/TransferChecked -> treasury_transfer).
# ProposalTransactionV2: u8 type(13) · proposal 32 · u8 option · u16 index · u32 hold_up · Vec<InstructionData>.
# Run: python3 proposal_scan.py <out-json> <realm>...    (since = 12 months before today)
import sys, json, time, struct, re, datetime
from rpc import call, sigs, utc, b58, base64

G = "GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"
if len(sys.argv) > 2 and sys.argv[1] == "--program": G = sys.argv[2]; del sys.argv[1:3]
LOADER = "BPFLoaderUpgradeab1e11111111111111111111111"
TOKENS = {"TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"}
SINCE = (datetime.datetime.utcnow() - datetime.timedelta(days=365)).strftime('%Y-%m-%d')

def instructions(d, o):
    n = struct.unpack_from('<I', d, o)[0]; o += 4; out = []
    for _ in range(n):
        pid = b58(d[o:o + 32]); o += 32
        na = struct.unpack_from('<I', d, o)[0]; o += 4 + na * 34
        dl = struct.unpack_from('<I', d, o)[0]; o += 4
        out.append((pid, d[o:o + dl])); o += dl
    return out

def classify(ixs):
    worst = 'none'
    for pid, data in ixs:
        tag = struct.unpack_from('<I', data, 0)[0] if len(data) >= 4 else -1
        if pid == LOADER and tag == 3: return 'program_upgrade'
        if pid == LOADER and tag in (4, 7): worst = 'set_authority'
        if pid in TOKENS and data[:1] in (b'\x03', b'\x0c') and worst == 'none': worst = 'treasury_transfer'
    return worst

def gpa(filters, length=None):
    p = {"encoding": "base64", "filters": filters}
    if length is not None: p["dataSlice"] = {"offset": 0, "length": length}
    return call("getProgramAccounts", [G, p])

out_path, realms = sys.argv[1], sys.argv[2:]
result = {"since": SINCE, "realms": []}
for realm in realms:
    rd = base64.b64decode(call("getAccountInfo", [realm, {"encoding": "base64"}])["value"]["data"][0])
    name = ([n.decode() for n in re.findall(rb'[\x20-\x7e]{3,}', rd[33:200])] or [''])[-1]
    govs = [g["pubkey"] for g in gpa([{"memcmp": {"offset": 1, "bytes": realm}}], 1) if base64.b64decode(g["account"]["data"][0])[0] in (18, 19, 20, 21, 25, 26)]
    props = []
    for g in govs:
        for p in gpa([{"memcmp": {"offset": 1, "bytes": g}}], 1):
            if base64.b64decode(p["account"]["data"][0])[0] != 14: continue
            s = sigs(p["pubkey"])
            if not s or utc(s[-1]["blockTime"]) < SINCE: continue
            txs = gpa([{"memcmp": {"offset": 1, "bytes": p["pubkey"]}}])
            touches = 'none'
            for t in txs:
                d = base64.b64decode(t["account"]["data"][0])
                if d[0] != 13: continue
                try: c = classify(instructions(d, 40))
                except Exception: c = 'undecodable'
                rank = ['none', 'undecodable', 'treasury_transfer', 'set_authority', 'program_upgrade']
                if rank.index(c) > rank.index(touches): touches = c
            props.append({"proposal": p["pubkey"], "governance": g, "created": utc(s[-1]["blockTime"]), "touches": touches, "tx_accounts": len(txs)})
            time.sleep(0.4)
    fires = [x for x in props if x["touches"] in ('program_upgrade', 'set_authority', 'treasury_transfer')]
    result["realms"].append({"realm": realm, "name": name, "proposals": len(props), "would_fire": len(fires), "by_kind": {k: sum(1 for x in fires if x["touches"] == k) for k in ('program_upgrade', 'set_authority', 'treasury_transfer')}, "list": props})
    print(f"{name[:28]:28} proposals {len(props):4}  would fire {len(fires):3}  {result['realms'][-1]['by_kind']}", flush=True)
    json.dump(result, open(out_path, "w"), indent=1)
tot_p = sum(r["proposals"] for r in result["realms"]); tot_f = sum(r["would_fire"] for r in result["realms"])
print("TOTAL proposals", tot_p, "would fire", tot_f)
