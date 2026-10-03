#!/usr/bin/env bash
# Ship the moat build to the box (2026-10-03): anchored daily log, spl-governance proposal decoding,
# control_proposal_pending rule, admin-key scan. Copies the changed sources, rebuilds the two packages,
# migrates (adds daily_anchor), turns anchoring on with a devnet-only key, restarts the worker, runs the
# daily job once and verifies today's anchor. Run from the repo root: bash scripts/deploy-moat.sh
set -euo pipefail
BOX=root@176.97.72.180; KEY=~/.ssh/ledge_box; APP=/home/keyholder/app
SSH="ssh -i $KEY -o BatchMode=yes $BOX"
FILES=(
  packages/risk/src/rules.ts
  packages/decoder/src/spl-gov-decoder.ts packages/decoder/src/index.ts
  apps/worker/src/schema.ts apps/worker/src/runner.ts
  apps/worker/src/pipeline/decode.ts apps/worker/src/pipeline/risk.ts
  apps/worker/src/coverage/daily.ts apps/worker/src/coverage/anchor.ts apps/worker/src/coverage/verify-anchor.ts apps/worker/src/coverage/admin-keys.ts
)
tar czf - "${FILES[@]}" apps/worker/drizzle | $SSH "cd $APP && tar xzf - && chown -R keyholder:keyholder $APP/packages $APP/apps/worker/src $APP/apps/worker/drizzle"
scp -q -i $KEY ~/.keyholder/anchor-devnet.json $BOX:/etc/keyholder/anchor-devnet.json
$SSH "set -e
chown keyholder:keyholder /etc/keyholder/anchor-devnet.json && chmod 600 /etc/keyholder/anchor-devnet.json
grep -q '^ANCHOR_KEYPAIR_PATH=' /etc/keyholder/env || echo 'ANCHOR_KEYPAIR_PATH=/etc/keyholder/anchor-devnet.json' >> /etc/keyholder/env
cd $APP/packages/risk && sudo -u keyholder npx tsc
cd $APP/packages/decoder && sudo -u keyholder npx tsc
cd $APP/apps/worker && sudo -u keyholder bash -c 'set -a; . /etc/keyholder/env; set +a; npx tsx src/migrate.ts' | tail -1
systemctl restart keyholder-worker && sleep 20 && systemctl is-active keyholder-worker
systemctl start keyholder-daily && journalctl -u keyholder-daily -n 3 --no-pager | tail -1
cd $APP/apps/worker && sudo -u keyholder bash -c 'set -a; . /etc/keyholder/env; set +a; npx tsx src/coverage/verify-anchor.ts \$(date -u +%F)' | tail -1"
