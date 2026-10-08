#!/usr/bin/env bash
# Ship the pending-action reader to the box: decoder + explainer + job, the pending_action table, and a
# systemd timer that runs the scan every 30 minutes. Then run it once.
# Run from the repo root: bash scripts/deploy-pending.sh
set -euo pipefail
export COPYFILE_DISABLE=1
BOX=root@176.97.72.180; KEY=~/.ssh/ledge_box; APP=/home/keyholder/app
SSH="ssh -i $KEY -o BatchMode=yes $BOX"
tar czf - \
  apps/worker/package.json apps/worker/src/schema.ts apps/worker/drizzle apps/worker/src/records \
  packages/decoder/test/fixtures/squads-v4-idl.json package.json pnpm-lock.yaml pnpm-workspace.yaml \
  | $SSH "cd $APP && tar xzf - && chown -R keyholder:keyholder $APP/apps/worker $APP/packages/decoder/test $APP/pnpm-lock.yaml"
$SSH "set -eo pipefail
RUN='systemd-run --quiet --wait --pipe --collect -p User=keyholder -p EnvironmentFile=/etc/keyholder/env -p WorkingDirectory=$APP/apps/worker'
cd $APP && sudo -u keyholder env CI=true pnpm install --frozen-lockfile --reporter=append-only 2>&1 | tail -2
\$RUN $APP/apps/worker/node_modules/.bin/tsx src/migrate.ts
cat > /etc/systemd/system/keyholder-pending.service <<UNIT
[Unit]
Description=Keyholder pending control actions (open multisig proposals, explained)
[Service]
Type=oneshot
User=keyholder
WorkingDirectory=$APP/apps/worker
EnvironmentFile=/etc/keyholder/env
ExecStart=$APP/apps/worker/node_modules/.bin/tsx src/records/pending-run.ts
MemoryMax=350M
UNIT
cat > /etc/systemd/system/keyholder-pending.timer <<UNIT
[Unit]
Description=Run keyholder-pending every 30 minutes
[Timer]
OnBootSec=5min
OnUnitActiveSec=30min
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload && systemctl enable --now keyholder-pending.timer >/dev/null
systemctl start keyholder-pending && journalctl -u keyholder-pending -n 30 --no-pager -o cat | grep '\"open\"' | tail -1"
