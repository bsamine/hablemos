#!/usr/bin/env bash
# Copy the latest server backups to this Mac, so a copy lives off the server.
#   ./scripts/pull-backup.sh            (to ~/Documents/workspace/perso/hablemos-backups)
# Keeps the 8 most recent local copies. Safe to run any time; suggested: weekly.
set -euo pipefail
SERVER="${SERVER:-root@62.171.172.248}"
DIR="${DIR:-/opt/hablemos}"
DEST="${DEST:-$HOME/Documents/workspace/perso/hablemos-backups}"
mkdir -p "$DEST"
LATEST=$(ssh "$SERVER" "ls -1t '$DIR/data/backups'/hablemos-*.db 2>/dev/null | head -1")
[ -n "$LATEST" ] || { echo "✗ No backup found on the server in $DIR/data/backups"; exit 1; }
rsync -az "$SERVER:$LATEST" "$DEST/"
echo "✓ $(basename "$LATEST") → $DEST"
ls -1t "$DEST"/hablemos-*.db | tail -n +9 | while read -r old; do rm -f "$old"; done
