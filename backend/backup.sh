#!/usr/bin/env bash
# Backup de Clasificados VIP: dump de la DB + volúmenes (private_media KYC + media).
# Se ejecuta como root vía cron:  0 3 * * *  sudo /opt/vip/backup.sh >> ...log 2>&1
# Off-site: si rclone está configurado con un remote 'spaces:', sube los backups.
set -euo pipefail
umask 077

ENV_FILE=/opt/vip/backend/.env.production
BACKUP_DIR=/opt/vip/backups
KEEP=14
NET=easypanel
PM_VOL=backend_vip_private_media
MEDIA_VOL=backend_vip_media
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*.sql.gz' -o -name 'media-*.tar.gz' \) \
  -exec chmod 600 {} + 2>/dev/null || true

if [[ ! -r "$ENV_FILE" ]]; then
  echo "ERROR: no existe o no se puede leer $ENV_FILE" >&2
  exit 1
fi

# Extrae una clave del .env sin "source" (evita interpolación de $ y comillas).
getenv() {
  local v
  v="$(grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  v="${v%\"}"; v="${v#\"}"; v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

require_env() {
  local key="$1" value
  value="$(getenv "$key")"
  if [[ -z "$value" ]]; then
    echo "ERROR: falta $key en $ENV_FILE" >&2
    exit 1
  fi
  printf '%s' "$value"
}

PG_DB="$(require_env POSTGRES_DB)"
PG_USER="$(require_env POSTGRES_USER)"
PG_PASS="$(require_env POSTGRES_PASSWORD)"
PG_HOST="$(require_env POSTGRES_HOST)"
PG_PORT="$(getenv POSTGRES_PORT)"; PG_PORT="${PG_PORT:-5432}"

RUN_DIR="$(mktemp -d "$BACKUP_DIR/.vip-backup.XXXXXX")"
RUN_NAME="$(basename "$RUN_DIR")"
DB_TMP="$RUN_DIR/db-$STAMP.sql.gz"
MEDIA_TMP="$RUN_DIR/media-$STAMP.tar.gz"

cleanup() {
  rm -rf "$RUN_DIR"
}
trap cleanup EXIT

# 1) Dump lógico de la base vip (pg_dump 17, en la red de EasyPanel).
docker run --rm --network "$NET" -e PGPASSWORD="$PG_PASS" postgres:17-alpine \
  pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" \
  --no-owner --clean --if-exists \
  | gzip > "$DB_TMP"
gzip -t "$DB_TMP"
[[ -s "$DB_TMP" ]]

# 2) Volúmenes: private_media (KYC cifrado) + media público.
docker run --rm \
  -v "$PM_VOL":/pm:ro -v "$MEDIA_VOL":/m:ro -v "$BACKUP_DIR":/out alpine \
  tar czf "/out/$RUN_NAME/media-$STAMP.tar.gz" -C / pm m
tar -tzf "$MEDIA_TMP" >/dev/null
[[ -s "$MEDIA_TMP" ]]

# Publicar ambos artefactos de forma atómica: un fallo no deja un backup con
# nombre final que otro proceso pueda confundir con un backup válido.
mv "$DB_TMP" "$BACKUP_DIR/db-$STAMP.sql.gz"
mv "$MEDIA_TMP" "$BACKUP_DIR/media-$STAMP.tar.gz"

# 3) Rotación: conservar los últimos $KEEP de cada tipo.
ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null    | tail -n +$((KEEP+1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/media-*.tar.gz 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

# 4) Off-site opcional (avisa si rclone/remote 'spaces:' no está configurado).
HAS_SPACES_REMOTE=0
if command -v rclone >/dev/null 2>&1; then
  RCLONE_REMOTES="$(rclone listremotes 2>/dev/null || true)"
  if printf '%s\n' "$RCLONE_REMOTES" | grep -q '^spaces:$'; then
    HAS_SPACES_REMOTE=1
  fi
fi
if [[ "$HAS_SPACES_REMOTE" == "1" ]]; then
  rclone copy "$BACKUP_DIR" "spaces:vip-backups/$(hostname)" \
    --max-age 26h --no-traverse \
    --include 'db-*.sql.gz' --include 'media-*.tar.gz'
  echo "[$(date '+%F %T')] off-site (rclone) OK"
else
  echo "[$(date '+%F %T')] aviso: off-site no configurado (remote spaces:)" >&2
fi

DBSZ="$(du -h "$BACKUP_DIR/db-$STAMP.sql.gz"    | cut -f1)"
MSZ="$(du -h "$BACKUP_DIR/media-$STAMP.tar.gz" | cut -f1)"
echo "[$(date '+%F %T')] backup OK: db-$STAMP.sql.gz ($DBSZ) + media-$STAMP.tar.gz ($MSZ)"
