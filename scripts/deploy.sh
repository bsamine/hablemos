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

HOST=$(grep '^APP_HOST=' .env | cut -d= -f2)
ours_running=$(docker compose ps -q caddy 2>/dev/null || true)
other=$(docker ps --format '{{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:443->' | grep -v '^hablemos-' | cut -d' ' -f1 | head -1 || true)

if [ -n "$ours_running" ] || [ -z "$other" ]; then
  echo "  Ports 80/443 free → using our own Caddy."
  docker compose up -d --build
elif docker inspect "$other" --format '{{.Config.Image}}' | grep -q '^caddy'; then
  NET=$(docker inspect "$other" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' | awk '{print $1}')
  CF=$(docker inspect "$other" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}')
  if [ -z "$CF" ]; then
    D=$(docker inspect "$other" --format '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}')
    [ -n "$D" ] && [ -f "$D/Caddyfile" ] && CF="$D/Caddyfile"
  fi
  echo "  Existing Caddy found: $other (network $NET) → sharing it."
  docker compose rm -sf caddy >/dev/null 2>&1 || true
  PROXY_NETWORK="$NET" docker compose -f docker-compose.yml -f docker-compose.shared-caddy.yml up -d --build app
  if [ -z "$CF" ]; then
    echo "  ✗ Could not find $other's Caddyfile on the host. Add this block to it manually:"
    printf '\n%s {\n\tencode gzip\n\treverse_proxy hablemos-app:3000\n}\n' "$HOST"
  elif grep -q "^$HOST" "$CF"; then
    echo "  Caddyfile already has $HOST."
  else
    cp "$CF" "$CF.bak-$(date +%Y%m%d-%H%M%S)"
    # Append (keeps the file's inode, so the bind mount sees the change).
    printf '\n# --- Hablemos (added by hablemos/scripts/deploy.sh)\n%s {\n\tencode gzip\n\treverse_proxy hablemos-app:3000\n}\n' "$HOST" >> "$CF"
    echo "  Added $HOST to $CF (backup saved next to it)."
  fi
  if docker exec "$other" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile; then
    echo "  Caddy reloaded."
  else
    echo "  ✗ Caddy reload failed — the previous config is still running. Restore the backup if needed."
  fi
else
  echo ""
  echo "  Ports 80/443 are used by $other (not Caddy):"
  ss -tlnp | grep -E ':(80|443)\s' | sed 's/^/    /'
  echo "  → Starting the app on 127.0.0.1:3000 only. Point $HOST to it in that proxy."
  docker compose -f docker-compose.yml -f docker-compose.noproxy.yml up -d --build app
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
