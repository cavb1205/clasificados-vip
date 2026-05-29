"""Cron job: borra stories cuyo expires_at ya pasó.

Diseñado para ejecutarse cada hora desde crontab:
    0 * * * *  sudo docker exec vip-backend python manage.py delete_expired_stories

Borra el archivo físico del storage Y la fila de la DB — la idea es que el
contenido efímero no deje rastro permanente (privacidad + storage).
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.stories.models import Story


class Command(BaseCommand):
    help = "Borra stories expiradas (archivo + fila)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        now = timezone.now()
        qs = Story.objects.filter(expires_at__lte=now)
        count = qs.count()
        if opts["dry_run"]:
            self.stdout.write(self.style.WARNING(f"[dry-run] borraría {count} story(s)."))
            return
        deleted = 0
        for s in qs:
            try:
                s.file.delete(save=False)
            except Exception:
                pass
            s.delete()
            deleted += 1
        self.stdout.write(self.style.SUCCESS(f"{deleted} story(s) eliminada(s)."))
