# Join the dollar floor (dollars.py output) to each program's control class (design/MOAT-BUILD.md, B3).
# Classes: one_signer (single key, or a multisig with threshold 1), multisig_no_timelock, multisig_timelock,
# governance, unresolved. Vaults are deduplicated across programs (a vault counts once, under the program
# that moved funds out of it). Run: python3 dollars_join.py <dollars-json> <out-json>
import json, sys

src, out = json.load(open(sys.argv[1])), sys.argv[2]

def control_class(p):
    k, m = p.get("authorityKind"), p.get("multisig") or {}
    if k == "single_key" or (m and m.get("threshold") == 1): return "one_signer"
    if k in ("squads_vault", "squads_v4_direct", "coral_multisig") and m:
        return "multisig_timelock" if (m.get("timeLockS") or 0) > 0 else "multisig_no_timelock"
    if k == "spl_gov": return "governance"
    return "unresolved"

seen, classes, rows = set(), {}, []
for p in src["programs"]:
    usd = 0.0
    for addr, v in (p.get("vaults") or {}).items():
        if addr in seen or v.get("usd") is None: continue
        seen.add(addr); usd += v["usd"]
    c = control_class(p)
    classes[c] = classes.get(c, 0.0) + usd
    m = p.get("multisig") or {}
    rows.append({"programId": p["programId"], "class": c, "threshold": m.get("threshold"), "members": m.get("memberCount"), "timeLockS": m.get("timeLockS"), "usd_floor": round(usd, 2), "vaults": len(p.get("vaults") or {}), "error": p.get("error")})
total = sum(classes.values())
res = {"priced_at": src.get("priced_at"), "method": "lower bound: vaults seen moving in each program's recent transactions, current balances, Jupiter prices, mints with >= $100k liquidity only",
       "total_usd_floor": round(total, 2), "by_class": {k: round(v, 2) for k, v in sorted(classes.items(), key=lambda x: -x[1])},
       "share": {k: round(v / total, 4) if total else None for k, v in classes.items()}, "programs": sorted(rows, key=lambda r: -r["usd_floor"])}
json.dump(res, open(out, "w"), indent=1)
print("total", round(total), res["by_class"])
for r in res["programs"][:15]: print(f'{r["programId"][:8]} {r["class"]:22} {r["threshold"]}/{r["members"]} tl={r["timeLockS"]} ${r["usd_floor"]:,.0f}')
