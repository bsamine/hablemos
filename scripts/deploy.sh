#!/usr/bin/env bash
# Deploy Hablemos from this Mac to the Contabo server in one command:
#   ./scripts/deploy.sh
# Override the target with: SERVER=root@1.2.3.4 ./scripts/deploy.sh
set -euo pipefail

SERVER="${SERVER:-root@62.171.172.248}"
DIR="${DIR:-/opt/hablemos}"
cd "$(dirname "$0")/.."

[ -f .env ] || { echo "✗ .env is missing — copy .env.example to .env and fill it in."; exit 1; }
grep -q '^GEMINI_API_KEY=.\+' .env || { echo "✗ GEMINI_API_KEY is empty in .env"; exit 1; }

# One SSH connection for every step: the password (if any) is asked only once.
CTL="/tmp/hablemos-ssh-%r@%h:%p"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$CTL" -o ControlPersist=120)

echo "→ Connecting to $SERVER"
ssh "${SSH_OPTS[@]}" "$SERVER" "mkdir -p '$DIR/data'"

echo "→ Copying the app (code + .env) to $DIR"
rsync -az --delete \
  --exclude node_modules --exclude .next --exclude data --exclude .git --exclude '.DS_Store' \
  -e "ssh ${SSH_OPTS[*]}" ./ "$SERVER:$DIR/"

echo "→ Building and starting on the server"
ssh "${SSH_OPTS[@]}" "$SERVER" "DIR='$DIR' bash -s" <<'REMOTE'
set -euo pipefail
cd "$DIR"
chmod 600 .env
chown -R 1000:1000 data

if ! command -v docker >/dev/null; then
  echo "  Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

ours_running=$(docker compose ps -q caddy 2>/dev/null || true)
if [ -z "$ours_running" ] && ss -tlnp | grep -qE ':(80|443)\s'; then
  echo ""
  echo "  Ports 80/443 are already used by another program:"
  ss -tlnp | grep -E ':(80|443)\s' | sed 's/^/    /'
  echo "  → Starting the app on 127.0.0.1:3000 only (README, Option B)."
  echo "    Point hablemos.62-171-172-248.sslip.io to http://127.0.0.1:3000 in that proxy."
  docker compose -f docker-compose.yml -f docker-compose.noproxy.yml up -d --build app
else
  docker compose up -d --build
fi

echo ""
docker compose ps
echo ""
echo "  Last app logs:"
sleep 3
docker compose logs --tail 20 app
REMOTE

HOST=$(grep '^APP_HOST=' .env | cut -d= -f2)
echo ""
echo "✓ Done. Open https://${HOST} (first load can take ~30 s while the certificate is issued)."
