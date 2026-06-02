#!/usr/bin/env bash
# Prueba de restauración AISLADA: backup fresco → restaurar en un Postgres
# efímero (NO toca la DB de producción) → comparar conteos vs prod + media tar.
set -euo pipefail

BACKUP_DIR=/opt/vip/backups
CT=vip-restore-test
TABLES="users_customuser profiles_modelprofile rooms_roomlisting rooms_hostprofile publications_publication verification_verificationrequest media_content_mediacontent"

cleanup() {
  sudo docker rm -f "$CT" >/dev/null 2>&1 || true
  sudo rm -rf /tmp/vip-restore-media
}
trap cleanup EXIT

echo "→ 1) Backup fresco del estado actual"
sudo /opt/vip/backup.sh | tail -1
DUMP=$(ls -t "$BACKUP_DIR"/db-*.sql.gz | head -1)
MEDIA=$(ls -t "$BACKUP_DIR"/media-*.tar.gz | head -1)
echo "   dump:  $(basename "$DUMP")"
echo "   media: $(basename "$MEDIA")"

echo "→ 2) Conteos en PRODUCCIÓN (referencia)"
sudo docker exec vip-backend python manage.py shell -c "
from django.contrib.auth import get_user_model
from apps.profiles.models import ModelProfile
from apps.rooms.models import RoomListing, HostProfile
from apps.publications.models import Publication
from apps.verification.models import VerificationRequest
from apps.media_content.models import MediaContent
U=get_user_model()
pairs=[('users_customuser',U),('profiles_modelprofile',ModelProfile),('rooms_roomlisting',RoomListing),('rooms_hostprofile',HostProfile),('publications_publication',Publication),('verification_verificationrequest',VerificationRequest),('media_content_mediacontent',MediaContent)]
for n,m in pairs: print(n, m.objects.count())
" 2>/dev/null | grep -E '^[a-z]' > /tmp/prodcounts.txt
cat /tmp/prodcounts.txt | sed 's/^/   /'

echo "→ 3) Postgres efímero (postgres:17, aislado)"
sudo docker run -d --name "$CT" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=restoretest postgres:17-alpine >/dev/null
for i in $(seq 1 30); do sudo docker exec "$CT" pg_isready -U postgres -q && break; sleep 1; done

echo "→ 4) Restaurando el dump en la DB efímera"
gunzip -c "$DUMP" | sudo docker exec -i "$CT" psql -q -U postgres -d restoretest > /tmp/restore.out 2> /tmp/restore.err || true
ERRS=$(grep -c "^ERROR" /tmp/restore.err || true)
echo "   errores de psql durante el restore: $ERRS"
[ "$ERRS" -gt 0 ] && grep "^ERROR" /tmp/restore.err | head -5 | sed 's/^/     /'

echo "→ 5) Comparación de conteos (restaurado vs prod)"
ALLOK=1
for t in $TABLES; do
  P=$(awk -v k="$t" '$1==k{print $2}' /tmp/prodcounts.txt)
  R=$(sudo docker exec "$CT" psql -tAq -U postgres -d restoretest -c "SELECT count(*) FROM $t;" 2>/dev/null | tr -d '[:space:]')
  if [ "$R" = "$P" ]; then ST="OK"; else ST="DIFF"; ALLOK=0; fi
  printf "   %-40s restaurado=%-4s prod=%-4s %s\n" "$t" "${R:-?}" "${P:-?}" "$ST"
done

echo "→ 6) Verificación del media tar (private_media KYC + media)"
mkdir -p /tmp/vip-restore-media
sudo tar xzf "$MEDIA" -C /tmp/vip-restore-media
echo "   archivos extraídos: $(find /tmp/vip-restore-media -type f | wc -l) (pm: $(find /tmp/vip-restore-media/pm -type f 2>/dev/null | wc -l), m: $(find /tmp/vip-restore-media/m -type f 2>/dev/null | wc -l))"

echo "──────────────────────────────────────────────"
[ "$ALLOK" = "1" ] && [ "$ERRS" = "0" ] && echo "✓ RESTORE VÁLIDO: todos los conteos coinciden y sin errores." || echo "⚠ Revisar diferencias arriba."
