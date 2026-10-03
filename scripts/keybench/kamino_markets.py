# Kamino Lending: value in each lending market grouped by who owns the market (single key / multisig PDA / ...).
# Reserve layout (8624 bytes): lending_market at 32, mint at 128, supply vault at 160 (offsets verified: every vault's mint must match).
# Market owners come from data/coverage/admin-keys-<day>.json (field lendingMarketOwner). Prices: Jupiter, mints with >= $100k liquidity.
# Run: python3 kamino_markets.py <admin-keys-json> <out-json>
import json, sys, time, base64, urllib.request
from rpc import call, b58, utc
P = "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
ak = json.load(open(sys.argv[1]))
owner = {}
for p in ak["programs"]:
    if p["programId"] != P: continue
    for k in p.get("keys", []):
        if k.get("field") == "lendingMarketOwner": owner[k["address"]] = (k["key"], k["kind"])
res = call("getProgramAccounts", [P, {"encoding": "base64", "dataSlice": {"offset": 32, "length": 160}, "filters": [{"dataSize": 8624}]}])
reserves = []
for a in res:
    d = base64.b64decode(a["account"]["data"][0])
    reserves.append({"reserve": a["pubkey"], "market": b58(d[0:32]), "mint": b58(d[96:128]), "vault": b58(d[128:160])})
for i in range(0, len(reserves), 100):
    vs = call("getMultipleAccounts", [[r["vault"] for r in reserves[i:i + 100]], {"encoding": "jsonParsed"}])["value"]
    for r, v in zip(reserves[i:i + 100], vs):
        try:
            info = v["data"]["parsed"]["info"]
            r["amount"] = float(info["tokenAmount"]["uiAmountString"]) if info["mint"] == r["mint"] else None
        except Exception: r["amount"] = None
mints = sorted({r["mint"] for r in reserves})
px = {}
for i in range(0, len(mints), 50):
    px.update(json.load(urllib.request.urlopen(urllib.request.Request("https://lite-api.jup.ag/price/v3?ids=" + ",".join(mints[i:i + 50]), headers={"User-Agent": "curl/8.7.1"}), timeout=60)))
    time.sleep(1)
markets = {}
bad = 0
for r in reserves:
    if r["amount"] is None: bad += 1; continue
    q = px.get(r["mint"])
    usd = r["amount"] * q["usdPrice"] if q and q.get("usdPrice") and (q.get("liquidity") or 0) >= 100_000 else 0.0
    m = markets.setdefault(r["market"], {"market": r["market"], "owner": owner.get(r["market"], (None, "unknown"))[0], "owner_kind": owner.get(r["market"], (None, "unknown"))[1], "usd": 0.0, "reserves": 0})
    m["usd"] += usd; m["reserves"] += 1
by_kind = {}
for m in markets.values(): by_kind[m["owner_kind"]] = by_kind.get(m["owner_kind"], 0) + m["usd"]
out = {"priced_at": utc(time.time()), "program": P, "reserves": len(reserves), "reserves_mint_mismatch": bad, "by_owner_kind_usd": {k: round(v, 2) for k, v in sorted(by_kind.items(), key=lambda x: -x[1])},
       "markets": sorted(({**m, "usd": round(m["usd"], 2)} for m in markets.values()), key=lambda m: -m["usd"])}
json.dump(out, open(sys.argv[2], "w"), indent=1)
print(json.dumps(out["by_owner_kind_usd"], indent=1)); print("reserves", len(reserves), "mismatch", bad)
for m in out["markets"][:10]: print(m["market"][:8], m["owner_kind"], (m["owner"] or "")[:8], f'${m["usd"]:,.0f}', m["reserves"])
