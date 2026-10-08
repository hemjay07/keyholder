#!/usr/bin/env bash
# Ship record v2 to the box (design/REVAMP-3.md D1-D7): stages package, full-decode admin scan, record
# builder (stages, signers, feed, claims), daily log v2 (timelock, version, full universe), the new tables.
# Then build the record for every logged day (--db), and run the record build after each daily log.
# Run from the repo root: bash scripts/deploy-records.sh
set -euo pipefail
export COPYFILE_DISABLE=1
BOX=root@176.97.72.180; KEY=~/.ssh/ledge_box; APP=/home/keyholder/app
SSH="ssh -i $KEY -o BatchMode=yes $BOX"
tar czf - \
  packages/stages/package.json packages/stages/tsconfig.json packages/stages/src \
  packages/decoder/src/anchor-decoder.ts packages/decoder/src/spl-gov-decoder.ts packages/decoder/src/index.ts \
  apps/worker/package.json apps/worker/src/schema.ts apps/worker/drizzle apps/worker/src/records \
  apps/worker/src/coverage/daily.ts apps/worker/src/coverage/anchor.ts apps/worker/src/coverage/verify-anchor.ts apps/worker/src/coverage/admin-keys.ts \
  data/coverage/admin-keys-2026-10-03.json data/coverage/admin-keys-2026-10-08.json data/coverage/dollars-by-class-2026-10-04.json data/coverage/coverage-tvl-2026-10-02.json \
  package.json pnpm-lock.yaml pnpm-workspace.yaml \
  | $SSH "cd $APP && tar xzf - && mkdir -p data/claims data/records && chown -R keyholder:keyholder $APP/packages $APP/apps/worker $APP/data $APP/pnpm-lock.yaml"
$SSH "set -eo pipefail
RUN='systemd-run --quiet --wait --pipe --collect -p User=keyholder -p EnvironmentFile=/etc/keyholder/env -p WorkingDirectory=$APP/apps/worker'
cd $APP && sudo -u keyholder pnpm install --frozen-lockfile --silent --config.strict-dep-builds=false
cd $APP/packages/stages && sudo -u keyholder npx tsc
cd $APP/packages/decoder && sudo -u keyholder npx tsc
cd $APP/packages/risk && sudo -u keyholder npx tsc
\$RUN $APP/apps/worker/node_modules/.bin/tsx src/migrate.ts
# record build runs after every daily log (ExecStartPost: only if the log succeeded)
mkdir -p /etc/systemd/system/keyholder-daily.service.d
cat > /etc/systemd/system/keyholder-daily.service.d/records.conf <<UNIT
[Service]
ExecStartPost=/bin/sh -c 'cd $APP/apps/worker && $APP/apps/worker/node_modules/.bin/tsx src/records/build.ts \\\$(date -u +%%F) $APP/data/records --db'
UNIT
systemctl daemon-reload
systemctl restart keyholder-worker && sleep 15 && systemctl is-active keyholder-worker
\$RUN $APP/apps/worker/node_modules/.bin/tsx src/records/build.ts all $APP/data/records --db | grep '"day"' | cut -c1-160"
