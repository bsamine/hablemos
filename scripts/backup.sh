#!/usr/bin/env bash
# Daily backup of the Hablemos database, run on the server by cron (installed by deploy.sh).
# Keeps 14 days of copies in /opt/hablemos/data/backups.
set -euo pipefail
DIR="${DIR:-/opt/hablemos}"
cd "$DIR"
CID=$(docker compose ps -q app)
[ -n "$CID" ] || { echo "app container not running"; exit 1; }
STAMP=$(date +%Y-%m-%d)
docker exec "$CID" node -e "
  const fs = require('fs'); fs.mkdirSync('/app/data/backups', { recursive: true });
  require('better-sqlite3')('/app/data/hablemos.db')
    .backup('/app/data/backups/hablemos-$STAMP.db')
    .then(() => { console.log('backup ok: hablemos-$STAMP.db'); process.exit(0); })
    .catch((e) => { console.error(e); process.exit(1); });
"
find "$DIR/data/backups" -name 'hablemos-*.db' -mtime +14 -delete
