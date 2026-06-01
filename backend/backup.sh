#!/usr/bin/env bash
# Backup de Clasificados VIP: dump de la DB + volúmenes (private_media KYC + media).
# Se ejecuta como root vía cron:  0 3 * * *  sudo /opt/vip/backup.sh >> ...log 2>&1
# Off-site: si rclone está configurado con un remote 'spaces:', sube los backups.
set -euo pipefail

ENV_FILE=/opt/vip/backend/.env.production
BACKUP_DIR=/opt/vip/backups
KEEP=14
NET=easypanel
PM_VOL=backend_vip_private_media
MEDIA_VOL=backend_vip_media
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"

# Extrae una clave del .env sin "source" (evita interpolación de $ y comillas).
getenv() {
  local v
  v="$(grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

PG_DB="$(getenv POSTGRES_DB)"
PG_USER="$(getenv POSTGRES_USER)"
PG_PASS="$(getenv POSTGRES_PASSWORD)"
PG_HOST="$(getenv POSTGRES_HOST)"
PG_PORT="$(getenv POSTGRES_PORT)"; PG_PORT="${PG_PORT:-5432}"

# 1) Dump lógico de la base vip (pg_dump 17, en la red de EasyPanel).
docker run --rm --network "$NET" -e PGPASSWORD="$PG_PASS" postgres:17-alpine \
  pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
  --no-owner --clean --if-exists \
  | gzip > "$BACKUP_DIR/db-$STAMP.sql.gz"

# 2) Volúmenes: private_media (KYC cifrado) + media público.
docker run --rm \
  -v "$PM_VOL":/pm:ro -v "$MEDIA_VOL":/m:ro -v "$BACKUP_DIR":/out alpine \
  tar czf "/out/media-$STAMP.tar.gz" -C / pm m

# 3) Rotación: conservar los últimos $KEEP de cada tipo.
ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null    | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

# 4) Off-site opcional (no-op si rclone/remote 'spaces:' no está configurado).
if command -v rclone >/dev/null 2>&1 && rclone listremotes 2>/dev/null | grep -q '^spaces:'; then
  rclone copy "$BACKUP_DIR" "spaces:vip-backups/$(hostname)" --max-age 26h --no-traverse
  echo "[$(date '+%F %T')] off-site (rclone) OK"
fi

DBSZ="$(du -h "$BACKUP_DIR/db-$STAMP.sql.gz"    | cut -f1)"
MSZ="$(du -h "$BACKUP_DIR/media-$STAMP.tar.gz" | cut -f1)"
echo "[$(date '+%F %T')] backup OK: db-$STAMP.sql.gz ($DBSZ) + media-$STAMP.tar.gz ($MSZ)"
