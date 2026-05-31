"""Expira anuncios de habitación vencidos. Pensado para ejecutarse vía Cron:

    */15 * * * *  cd /ruta/backend && .venv/bin/python manage.py expire_rooms

Busca anuncios ACTIVE cuyo expires_at ya pasó y los marca EXPIRED.
Soporta --dry-run para inspeccionar sin escribir.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.rooms.models import RoomListing


class Command(BaseCommand):
    help = "Marca como expirados los anuncios de habitación activos cuya fecha pasó."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántos se expirarían sin modificar la base de datos.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        due = RoomListing.objects.filter(
            status=RoomListing.Status.ACTIVE, expires_at__lt=now
        )
        count = due.count()

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING(f"[dry-run] {count} anuncio(s) a expirar."))
            return

        updated = due.update(status=RoomListing.Status.EXPIRED, updated_at=now)
        self.stdout.write(self.style.SUCCESS(f"{updated} anuncio(s) marcado(s) como expirado(s)."))
