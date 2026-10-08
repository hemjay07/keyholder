#!/usr/bin/env bash
# Copy ANTHROPIC_API_KEY from an existing env file into Vercel (production) and the box's env, without
# printing it. Usage: bash scripts/set-anthropic-key.sh /path/to/some/project/.env
set -euo pipefail
SRC="${1:?usage: set-anthropic-key.sh /path/to/.env}"
KEY=$(grep -E '^ANTHROPIC_API_KEY=' "$SRC" | tail -1 | cut -d= -f2- | tr -d '"'"'"' \r')
[ -n "$KEY" ] || { echo "no ANTHROPIC_API_KEY line in $SRC"; exit 1; }
echo "found a key of ${#KEY} characters (not shown)"
cd ~/controlplane
vercel env rm ANTHROPIC_API_KEY production --yes >/dev/null 2>&1 || true
printf '%s' "$KEY" | vercel env add ANTHROPIC_API_KEY production >/dev/null && echo "set in Vercel (production)"
printf '%s\n' "$KEY" | ssh -i ~/.ssh/ledge_box -o BatchMode=yes root@176.97.72.180 \
  "read -r K; sed -i '/^ANTHROPIC_API_KEY=/d' /etc/keyholder/env; echo \"ANTHROPIC_API_KEY=\$K\" >> /etc/keyholder/env; chmod 600 /etc/keyholder/env" \
  && echo "set on the box (/etc/keyholder/env, mode 600)"
grep -q '^ANTHROPIC_API_KEY=' .env 2>/dev/null || { printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> .env; chmod 600 .env; echo "added to controlplane/.env (local dev)"; }
