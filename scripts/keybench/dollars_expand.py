# Complete the dollar floor for programs whose vaults share one PDA authority (design/MOAT-BUILD.md, B).
# dollars.py proves an authority signs for a program (the program moved tokens out of a vault it owns).
# For authorities that are PDAs with no data account of their own (owner None or System, off-curve), every token
# account they own is the program's: getTokenAccountsByOwner lists them all, so the sample becomes a census.
# Authorities that are program-owned accounts (one pool each) are left as sampled.
# Run: python3 dollars_expand.py <dollars-json> <out-json>
import json, sys, time, urllib.request
from rpc import call, utc

LIQ_FLOOR = 100_000
TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]
src = json.load(open(sys.argv[1]))
claimed = {}  # vault -> programId, first claim wins (programs are processed in file order)
for p in src["programs"]:
    for v in (p.get("vaults") or {}): claimed.setdefault(v, p["programId"])
for p in src["programs"]:
    auths = {x["authority"] for x in (p.get("vaults") or {}).values() if x.get("authority") and x.get("authority_owner") in (None, "11111111111111111111111111111111")}
    added = 0
    for a in sorted(auths):
        for tp in TOKEN_PROGRAMS:
            try:
                r = call("getTokenAccountsByOwner", [a, {"programId": tp}, {"encoding": "jsonParsed"}])["value"]
            except RuntimeError as e:
                print(p["programId"][:8], a[:8], "ERROR", e); continue
            for acc in r:
                addr = acc["pubkey"]
                if addr in claimed and claimed[addr] != p["programId"]: continue
                info = acc["account"]["data"]["parsed"]["info"]
                if addr not in p["vaults"]:
                    p["vaults"][addr] = {"mint": info["mint"], "authority": a, "authority_owner": "pda", "seen_in": "getTokenAccountsByOwner", "amount": float(info["tokenAmount"]["uiAmountString"] or 0)}
                    claimed[addr] = p["programId"]; added += 1
            time.sleep(0.5)
    p["expanded_authorities"] = sorted(auths)
    print(p["programId"][:8], "authorities", len(auths), "vaults added", added, flush=True)
mints = sorted({x["mint"] for p in src["programs"] for x in (p.get("vaults") or {}).values()})
px = {}
for i in range(0, len(mints), 50):
    px.update(json.load(urllib.request.urlopen(urllib.request.Request("https://lite-api.jup.ag/price/v3?ids=" + ",".join(mints[i:i + 50]), headers={"User-Agent": "curl/8.7.1"}), timeout=60)))
    time.sleep(1)
for p in src["programs"]:
    usd = 0.0
    for x in (p.get("vaults") or {}).values():
        q = px.get(x["mint"])
        x["usd"] = round(x["amount"] * q["usdPrice"], 2) if q and q.get("usdPrice") and (q.get("liquidity") or 0) >= LIQ_FLOOR else None
        usd += x["usd"] or 0
    p["usd_floor"] = round(usd, 2)
src["priced_at"] = utc(time.time()); src["method"] = "sampled vault discovery + census of shared-PDA authorities; see dollars.py and dollars_expand.py"
src["prices"] = {m: {"usd": px[m].get("usdPrice"), "liquidity": px[m].get("liquidity")} for m in px}
json.dump(src, open(sys.argv[2], "w"), indent=1)
print("TOTAL", round(sum(p.get("usd_floor", 0) for p in src["programs"]), 2))
