# Complete the dollar floor for programs whose vaults share one PDA authority (design/MOAT-BUILD.md, B).
# dollars.py proves an authority signs for a program (the program moved tokens out of a vault it owns).
# For authorities that are PDAs with no data account of their own (owner None or System, off-curve), every token
# account they own is the program's: getTokenAccountsByOwner lists them all, so the sample becomes a census.
# Authorities that are program-owned accounts (one pool each) are left as sampled.
# Run: python3 dollars_expand.py <dollars-json> <out-json>
import json, sys, time, urllib.request
from rpc import call, utc, b58
import base64

LIQ_FLOOR = 100_000
TOKEN_PROGRAMS = ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"]
src = json.load(open(sys.argv[1]))
# census vaults count only for mints the sampled run already priced as liquid (>= LIQ_FLOOR); memecoin pools are dropped
LIQUID = {m for m, q in (src.get('prices') or {}).items() if q.get('usd') and (q.get('liquidity') or 0) >= LIQ_FLOOR}
claimed = {}  # vault -> programId, first claim wins (programs are processed in file order)
for p in src["programs"]:
    for v in (p.get("vaults") or {}): claimed.setdefault(v, p["programId"])
for p in src["programs"]:
    auths = {x["authority"] for x in (p.get("vaults") or {}).values() if x.get("authority") and x.get("authority_owner") in (None, "11111111111111111111111111111111")}
    added = 0
    for a in sorted(auths):
        for tp in TOKEN_PROGRAMS:
            try:
                r = call("getTokenAccountsByOwner", [a, {"programId": tp}, {"encoding": "base64", "dataSlice": {"offset": 0, "length": 72}}])["value"]
            except RuntimeError as e:
                print(p["programId"][:8], a[:8], "ERROR", e); continue
            for acc in r:
                addr = acc["pubkey"]
                if addr in claimed and claimed[addr] != p["programId"]: continue
                raw = base64.b64decode(acc["account"]["data"][0])  # token account: mint 0..32, owner 32..64, amount u64 at 64
                mint = b58(raw[0:32])
                if mint not in LIQUID: continue
                info = {"mint": mint, "raw": int.from_bytes(raw[64:72], "little")}
                if addr not in p["vaults"]:
                    p["vaults"][addr] = {"mint": info["mint"], "authority": a, "authority_owner": "pda", "seen_in": "getTokenAccountsByOwner", "raw": info["raw"]}
                    claimed[addr] = p["programId"]; added += 1
            time.sleep(0.5)
    p["expanded_authorities"] = sorted(auths)
    print(p["programId"][:8], "authorities", len(auths), "vaults added", added, flush=True)
json.dump(src, open(sys.argv[2] + '.census', 'w'))  # census saved before pricing
mints = sorted({x["mint"] for p in src["programs"] for x in (p.get("vaults") or {}).values()})
px = {}
for i in range(0, len(mints), 50):
    for attempt in range(6):
        try:
            px.update(json.load(urllib.request.urlopen(urllib.request.Request("https://lite-api.jup.ag/price/v3?ids=" + ",".join(mints[i:i + 50]), headers={"User-Agent": "curl/8.7.1"}), timeout=60)))
            break
        except Exception as e:
            print("price fetch retry", attempt, e, flush=True); time.sleep(5 * (attempt + 1))
    time.sleep(1)
for p in src["programs"]:
    usd = 0.0
    for x in (p.get("vaults") or {}).values():
        q = px.get(x["mint"])
        if "raw" in x:  # census vaults carry raw units; Jupiter gives the mint's decimals
            x["amount"] = x["raw"] / 10 ** q["decimals"] if q and q.get("decimals") is not None else 0.0
        x["usd"] = round(x["amount"] * q["usdPrice"], 2) if q and q.get("usdPrice") and (q.get("liquidity") or 0) >= LIQ_FLOOR else None
        usd += x["usd"] or 0
    p["usd_floor"] = round(usd, 2)
src["priced_at"] = utc(time.time()); src["method"] = "sampled vault discovery + census of shared-PDA authorities; see dollars.py and dollars_expand.py"
src["prices"] = {m: {"usd": px[m].get("usdPrice"), "liquidity": px[m].get("liquidity")} for m in px}
json.dump(src, open(sys.argv[2], "w"), indent=1)
print("TOTAL", round(sum(p.get("usd_floor", 0) for p in src["programs"]), 2))
