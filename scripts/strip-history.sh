#!/usr/bin/env bash
# Remove build output and vendored deps from all history so the repo can go to GitHub (100 MB file limit).
# Backup of the full history: ~/controlplane-backup-2026-10-07.git. Run: bash scripts/strip-history.sh
set -euo pipefail
export PATH="$HOME/Library/Python/3.9/bin:$PATH"
cd ~/controlplane
git filter-repo --force --invert-paths \
  --path apps/web/.next \
  --path programs/keyholder/target \
  --path target \
  --path-glob '*/node_modules/*' \
  --path-glob 'node_modules/*'
for p in apps/web/.next/ target/ programs/keyholder/target/ node_modules/; do
  grep -qxF "$p" .gitignore || echo "$p" >> .gitignore
done
git add .gitignore
git commit -qm "gitignore build output and vendored deps"
git count-objects -vH | grep size-pack
git log --oneline | head -3
