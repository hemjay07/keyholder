# KeyBench record for the Rain card-contract exploit (Avici and others, Aug 2026), from chain reads.
# Attacker and program ids from Blockaid's write-up; every event below re-read from mainnet. Run: python3 rain.py
from rpc import *
import json
A = "FVNFzqAny8spWdPmYw6RQ9TkYa29ueFFiqCFD1gQnCEj"
EV = [("first_exploit_call", "SubmitSignatures (first)", "2j5y2oK3mUhUUkgVquYTu2nXa8iWytyySCWvGvzQGVUnR5pBAZ7s9KvCBJXj1X2hhMQBQgxWS9wof8dFiW8ju48i"),
      ("admin_granted", "AddCollateralAdmin (first): attacker grants itself withdrawal rights", "2gUKwke19T9LxRNhgynkzkSFosSpgMsJFMta6RX49ztKeXK8cKKA8CTdvnXuB5cuyrz1v5tf7xcQKUdBo6K1Qu3q"),
      ("first_loss", "WithdrawCollateralAsset (first)", "2oE6hQ7nFYpx9k1EUZuy93DsPqDUoo6MvSzMG8b8zGMZ7hUbzAzuYubicvRPK7Pcyvsxb1Hk35yB22dsC9jt3M5L")]
events = []
for kind, what, sig in EV:
    t = tx(sig)
    progs = sorted({l.split()[1] for l in t['meta']['logMessages'] if l.endswith('invoke [1]')} - {'ComputeBudget111111111111111111111111111111'})
    signer = [k['pubkey'] for k in t['transaction']['message']['accountKeys'] if k.get('signer')]
    assert A in signer, sig
    events.append({"kind": kind, "what": what, "sig": sig, "slot": t['slot'], "time": utc(t['blockTime']), "programs": progs})
inc = {"id": "rain-2026", "name": "Rain card contract (Aug 2026)", "class": "admin_grant_flaw",
       "sources": ["https://blockaid.io/blog/11m-rain-ecosystem-exploit-how-onchain-monitoring-gives-stablecoin-card-issuers-fleet-level-coverage", "https://www.coindesk.com/web3/2026/08/29/a-usd1-1-million-crypto-card-hack-crashed-a-neobank-s-token-49"],
       "attacker": A, "programs_per_blockaid": ["26DkA98jjctzPkBEteUsN935CR4dsKx3XvjrtE7MeL4a", "CWgkFB7ngUc9cGD1LryyhP7h6xYWtwrAjhSKKCoR1gkz", "3zVB27Gap6fbxpAcV2hsBBUcV3vRjkCikBXREiyBzDuc", "8r2jms1vAnHhtCWxDNSgiHvQNSzzJvGa9oBRCbBPCBNN"],
       "attacker_first_tx": {"sig": "3W2x5igVBrBzNzgLyJ6hN6Xdy3JE54gqqdZSvz8CHm75jbrEW1GsN1EAoBA6SaDEWTUK6Ey6hoXwVddvk6q2USVe", "time": "2026-08-28 13:40:41", "note": "FulfillOrder; attacker has 21,405 signatures in total"},
       "events": events, "read_at": "2026-10-03", "rpc": RPC}
json.dump(inc, open('/Users/mujeeb/controlplane/data/keybench/rain-2026.json', 'w'), indent=1)
for e in events: print(e['time'], e['kind'], e['programs'])
