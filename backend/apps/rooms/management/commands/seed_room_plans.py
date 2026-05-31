"""Carga planes de habitación de ejemplo (idempotente).

Son valores iniciales: el admin puede editarlos, agregar o desactivar cualquier
plan desde el panel sin tocar código. Todos con kind=room_listing.
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.publications.models import SubscriptionPlan

# (nombre, días, precio CLP, orden)
PLANS = [
    ("Habitación semanal", 7, 6000, 1),
    ("Habitación mensual", 30, 18000, 2),
]


class Command(BaseCommand):
    help = "Carga planes de habitación de ejemplo (idempotente)."

    def handle(self, *args, **options):
        created = 0
        for name, days, price, order in PLANS:
            _, is_new = SubscriptionPlan.objects.get_or_create(
                slug=slugify(name),
                defaults={
                    "name": name,
                    "kind": SubscriptionPlan.Kind.ROOM_LISTING,
                    "duration_days": days,
                    "price": price,
                    "order": order,
                },
            )
            created += int(is_new)
        self.stdout.write(self.style.SUCCESS(f"Seed planes habitación OK: {created} nuevo(s)."))
