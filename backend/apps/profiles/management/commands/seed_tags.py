"""Carga el catálogo inicial de etiquetas (servicios + extras + características).

Es solo una base para empezar; el admin agrega/edita/quita desde el panel sin
tocar código. Idempotente: re-ejecutar no crea duplicados ni borra cambios.
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.profiles.models import Service

# (categoría, [nombres]). El order respeta el orden de aparición.
CATALOG = [
    ("service", [
        "Compañía",
        "Salidas",
        "Cena",
        "Masaje sensual",
        "Masaje erótico",
        "Striptease",
        "Lluvia dorada",
        "Fetichismo",
        "Juegos de rol",
        "Despedidas de soltero",
    ]),
    ("extra", [
        "Hotel propio",
        "Atiendo en domicilio",
        "Acepto parejas",
        "Dúo",
        "Tríos",
        "24 horas",
        "Salidas a otras ciudades",
        "Viajes",
        "Fiestas privadas",
    ]),
    ("feature", [
        # cuerpo
        "Delgada",
        "Atlética",
        "Curvy",
        "Tonificada",
        # busto
        "Busto pequeño",
        "Busto mediano",
        "Busto grande",
        # cabello
        "Rubia",
        "Castaña",
        "Morena",
        "Pelirroja",
        "Cabello largo",
        # piel / origen
        "Piel blanca",
        "Piel canela",
        "Trigueña",
        "Latina",
        "Chilena",
        "Extranjera",
        # ojos
        "Ojos claros",
        "Ojos oscuros",
        # marcas
        "Tatuajes",
        "Piercings",
        "Sin tatuajes",
    ]),
]


class Command(BaseCommand):
    help = "Carga catálogo inicial de etiquetas (idempotente)."

    def handle(self, *args, **options):
        created = updated = 0
        order = 0
        for category, names in CATALOG:
            for name in names:
                order += 1
                obj, is_new = Service.objects.update_or_create(
                    slug=slugify(name),
                    defaults={"name": name, "category": category, "order": order},
                )
                if is_new:
                    created += 1
                else:
                    updated += 1
        self.stdout.write(
            self.style.SUCCESS(f"Seed tags OK: {created} nuevas, {updated} actualizadas.")
        )
