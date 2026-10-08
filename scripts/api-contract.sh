#!/usr/bin/env bash
# Contract checks for /api/v1 (record v2 routes). Exits non-zero on the first failed assertion.
# Usage: bash scripts/api-contract.sh [base-url]   (default http://localhost:3108)
set -euo pipefail
B="${1:-http://localhost:3108}/api/v1"
j() { curl -sf "$B/$1"; }
check() { python3 -c "import json,sys; d=json.load(sys.stdin)['data']; assert $2, '$1'; print('ok  $1')"; }
j stages   | check stages   "d['version']=='stages/v1' and len(d['rules'])==4 and d['summary'] is not None"
j records  | check records  "len(d['programs'])>0 and all(p['stage'] in (0,1,2,3) for p in d['programs']) and sum(s['programs'] for s in d['summary']['byStage'])==len(d['programs'])"
P=$(j records | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(max(d['programs'], key=lambda p: p['usdFloor'] or 0)['programId'])")
j "programs/$P" | check program "d['record']['programId']=='$P' and len(d['history'])>=1 and d['record']['stage']['stage'] in (0,1,2,3)"
K=$(j "signers?limit=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['data']['signers'][0]['key'])")
j "signers/$K" | check signer "d['signer']['key']=='$K' and len(d['signer']['multisigs'])>=1 and d['signer']['usdBehind']>=0"
j "changes?limit=5" | check changes "isinstance(d['events'], list)"
j claims | check claims "isinstance(d['checks'], list)"
code=$(curl -s -o /dev/null -w "%{http_code}" "$B/programs/11111111111111111111111111111111"); [ "$code" = 404 ] && echo "ok  unknown program -> 404" || { echo "FAIL unknown program -> $code"; exit 1; }
