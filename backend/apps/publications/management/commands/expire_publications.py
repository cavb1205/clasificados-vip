"""Expira publicaciones vencidas. Pensado para ejecutarse vía Cron Job:

    */15 * * * *  cd /ruta/backend && .venv/bin/python manage.py expire_publications

Busca publicaciones ACTIVE cuyo expires_at ya pasó y las marca EXPIRED.
Soporta --dry-run para inspeccionar sin escribir.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.publications.models import Publication


class Command(BaseCommand):
    help = "Marca como expiradas las publicaciones activas cuya fecha de expiración pasó."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra cuántas se expirarían sin modificar la base de datos.",
        )

    def handle(self, *args, **options):
        now = timezone.now()
        due = Publication.objects.filter(
            status=Publication.Status.ACTIVE, expires_at__lt=now
        )
        count = due.count()

        if options["dry_run"]:
            self.stdout.write(self.style.WARNING(f"[dry-run] {count} publicación(es) a expirar."))
            return

        updated = due.update(status=Publication.Status.EXPIRED, updated_at=now)
        self.stdout.write(self.style.SUCCESS(f"{updated} publicación(es) marcada(s) como expirada(s)."))
