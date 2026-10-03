# Small JSON-RPC helper for KeyBench chain reads (public mainnet by default; KEYBENCH_RPC overrides).
import json, os, time, urllib.request, base64, datetime
RPC = os.environ.get("KEYBENCH_RPC", "https://api.mainnet-beta.solana.com")
B = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
def call(m, p, tries=6):
    err = None
    for i in range(tries):
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(RPC, json.dumps({"jsonrpc": "2.0", "id": 1, "method": m, "params": p}).encode(), {"Content-Type": "application/json"}), timeout=120))
            if "result" in r: return r["result"]
            err = r.get("error")
        except Exception as e: err = str(e)
        time.sleep(2 + 2 * i)
    raise RuntimeError(f"{m} failed: {err}")
def b58(b):
    n = int.from_bytes(b, 'big'); s = ''
    while n: n, r = divmod(n, 58); s = B[r] + s
    return '1' * (len(b) - len(b.lstrip(b'\0'))) + s
def b58d(s):
    n = 0
    for c in s: n = n * 58 + B.index(c)
    raw = n.to_bytes((n.bit_length() + 7) // 8, 'big')
    return b'\0' * (len(s) - len(s.lstrip('1'))) + raw
def utc(t): return datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S') if t else None
def acct(a): 
    v = call("getAccountInfo", [a, {"encoding": "base64"}])["value"]
    return (v["owner"], base64.b64decode(v["data"][0])) if v else (None, b'')
def sigs(a, before=None, until=None, limit=1000):
    p = {"limit": limit}
    if before: p["before"] = before
    if until: p["until"] = until
    return call("getSignaturesForAddress", [a, p])
def all_sigs(a, cap=20000):
    out, before = [], None
    while len(out) < cap:
        s = sigs(a, before=before)
        if not s: break
        out += s; before = s[-1]["signature"]
        if len(s) < 1000: break
    return out
def tx(sig): return call("getTransaction", [sig, {"maxSupportedTransactionVersion": 1, "encoding": "jsonParsed"}])

# ed25519: is this 32-byte key a point on the curve (a possible keypair)? PDAs are off-curve.
_P = 2**255 - 19; _D = (-121665 * pow(121666, _P - 2, _P)) % _P
def on_curve(addr):
    b = bytearray(b58d(addr)); 
    if len(b) != 32: return False
    sign = b[31] >> 7; b[31] &= 0x7f; y = int.from_bytes(b, 'little')
    if y >= _P: return False
    u = (y * y - 1) % _P; v = (_D * y * y + 1) % _P
    x2 = u * pow(v, _P - 2, _P) % _P
    if x2 == 0: return sign == 0
    x = pow(x2, (_P + 3) // 8, _P)
    if (x * x - x2) % _P != 0: x = x * pow(2, (_P - 1) // 4, _P) % _P
    return (x * x - x2) % _P == 0
