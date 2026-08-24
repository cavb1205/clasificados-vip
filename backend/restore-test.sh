#!/usr/bin/env bash
# Prueba de restauración AISLADA: backup fresco → restaurar en un Postgres
# efímero (NO toca la DB de producción) → comparar modelos y archivos.
set -euo pipefail

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Ejecuta esta prueba con sudo: sudo /opt/vip/restore-test.sh" >&2
  exit 1
fi

BACKUP_DIR=/opt/vip/backups
CT="vip-restore-test-$$"
PM_VOL=backend_vip_private_media
MEDIA_VOL=backend_vip_media
WORK_DIR="$(mktemp -d /tmp/vip-restore.XXXXXX)"
PROD_COUNTS="$WORK_DIR/prodcounts.txt"
RESTORE_OUT="$WORK_DIR/restore.out"
RESTORE_ERR="$WORK_DIR/restore.err"

cleanup() {
  docker rm -f "$CT" >/dev/null 2>&1 || true
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "→ 1) Backup fresco del estado actual"
/opt/vip/backup.sh | tail -1
DUMP="$(ls -1t "$BACKUP_DIR"/db-*.sql.gz 2>/dev/null | head -1)"
BACKUP_STAMP="${DUMP##*/db-}"
BACKUP_STAMP="${BACKUP_STAMP%.sql.gz}"
MEDIA="$BACKUP_DIR/media-$BACKUP_STAMP.tar.gz"
[[ -s "$DUMP" && -s "$MEDIA" ]]
gzip -t "$DUMP"
tar -tzf "$MEDIA" >/dev/null
echo "   dump:  $(basename "$DUMP")"
echo "   media: $(basename "$MEDIA")"

echo "→ 2) Conteos en PRODUCCIÓN (todos los modelos gestionados)"
docker exec vip-backend python manage.py shell -c '
from django.apps import apps
for model in apps.get_models():
    opts = model._meta
    if opts.managed and not opts.proxy:
        print(f"{opts.db_table}\t{model.objects.count()}")
' > "$PROD_COUNTS"
[[ -s "$PROD_COUNTS" ]]
sed 's/^/   /' "$PROD_COUNTS"

echo "→ 3) Postgres efímero (postgres:17, aislado)"
docker run -d --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=restoretest postgres:17-alpine >/dev/null
READY=0
for _ in $(seq 1 30); do
  if docker exec "$CT" pg_isready -U postgres -q; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" != "1" ]]; then
  echo "ERROR: Postgres efímero no quedó listo." >&2
  exit 1
fi

echo "→ 4) Restaurando el dump en la DB efímera"
set +e
gunzip -c "$DUMP" | docker exec -i "$CT" psql -q -v ON_ERROR_STOP=1 -U postgres -d restoretest \
  > "$RESTORE_OUT" 2> "$RESTORE_ERR"
PIPE_STATUS=("${PIPESTATUS[@]}")
set -e
if [[ "${PIPE_STATUS[0]}" != "0" || "${PIPE_STATUS[1]}" != "0" ]]; then
  echo "ERROR: falló el restore del dump." >&2
  sed 's/^/     /' "$RESTORE_ERR" | head -20 >&2
  exit 1
fi

echo "→ 5) Comparación de conteos (restaurado vs prod)"
ALLOK=1
while IFS=$'\t' read -r table expected; do
  [[ -z "$table" ]] && continue
  restored="$(docker exec "$CT" psql -tAq -U postgres -d restoretest \
    -c "SELECT count(*) FROM \"$table\";" 2>/dev/null | tr -d '[:space:]')"
  if [[ "$restored" == "$expected" ]]; then
    result=OK
  else
    result=DIFF
    ALLOK=0
  fi
  printf '   %-48s restaurado=%-6s prod=%-6s %s\n' \
    "$table" "${restored:-?}" "$expected" "$result"
done < "$PROD_COUNTS"

echo "→ 6) Verificación del media tar (private_media + media)"
RESTORE_MEDIA="$WORK_DIR/media"
mkdir -p "$RESTORE_MEDIA"
tar xzf "$MEDIA" -C "$RESTORE_MEDIA"

PROD_PM="$(docker run --rm -v "$PM_VOL":/pm:ro alpine sh -c 'find /pm -type f | wc -l | tr -d " "')"
PROD_MEDIA="$(docker run --rm -v "$MEDIA_VOL":/m:ro alpine sh -c 'find /m -type f | wc -l | tr -d " "')"
RESTORE_PM="$(find "$RESTORE_MEDIA/pm" -type f 2>/dev/null | wc -l | tr -d ' ')"
RESTORE_MEDIA_COUNT="$(find "$RESTORE_MEDIA/m" -type f 2>/dev/null | wc -l | tr -d ' ')"
printf '   private_media: restaurado=%-6s prod=%-6s\n' "$RESTORE_PM" "$PROD_PM"
printf '   media:         restaurado=%-6s prod=%-6s\n' "$RESTORE_MEDIA_COUNT" "$PROD_MEDIA"
[[ "$RESTORE_PM" == "$PROD_PM" ]] || ALLOK=0
[[ "$RESTORE_MEDIA_COUNT" == "$PROD_MEDIA" ]] || ALLOK=0

echo "──────────────────────────────────────────────"
if [[ "$ALLOK" == "1" ]]; then
  echo "✓ RESTORE VÁLIDO: todos los conteos y archivos coinciden."
else
  echo "⚠ RESTORE INVÁLIDO: hay diferencias que revisar." >&2
  exit 1
fi
