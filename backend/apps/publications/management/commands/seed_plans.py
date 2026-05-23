"""Carga planes de suscripción de ejemplo (idempotente).

Son solo valores iniciales: el admin puede editarlos, agregar o desactivar
cualquier plan desde el panel sin tocar código.
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.publications.models import SubscriptionPlan

# (nombre, días, precio CLP, incluye_destacado, orden)
PLANS = [
    ("Diario", 1, 3000, False, 1),
    ("Semanal", 7, 12000, False, 2),
    ("Mensual", 30, 35000, False, 3),
    ("Mensual Destacado", 30, 55000, True, 4),
]


class Command(BaseCommand):
    help = "Carga planes de suscripción de ejemplo (idempotente)."

    def handle(self, *args, **options):
        created = 0
        for name, days, price, featured, order in PLANS:
            _, is_new = SubscriptionPlan.objects.get_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "duration_days": days,
                    "price": price,
                    "includes_featured": featured,
                    "order": order,
                },
            )
            created += int(is_new)
        self.stdout.write(self.style.SUCCESS(f"Seed planes OK: {created} plan(es) nuevo(s)."))
