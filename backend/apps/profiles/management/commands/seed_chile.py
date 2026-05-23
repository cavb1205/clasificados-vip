"""Carga las 16 regiones de Chile y sus principales comunas.

Idempotente: se puede correr varias veces. El set de comunas cubre las
principales por región y es fácilmente extensible (agregar a COMUNAS).
"""

from django.core.management.base import BaseCommand
from django.utils.text import slugify

from apps.profiles.models import City, Region

# (orden N→S, nombre de región, [comunas principales])
REGIONS = [
    (1, "Arica y Parinacota", ["Arica", "Camarones", "Putre"]),
    (2, "Tarapacá", ["Iquique", "Alto Hospicio", "Pozo Almonte"]),
    (3, "Antofagasta", ["Antofagasta", "Calama", "Tocopilla", "Mejillones"]),
    (4, "Atacama", ["Copiapó", "Vallenar", "Caldera", "Chañaral"]),
    (5, "Coquimbo", ["La Serena", "Coquimbo", "Ovalle", "Illapel"]),
    (6, "Valparaíso", ["Valparaíso", "Viña del Mar", "Quilpué", "Villa Alemana", "San Antonio", "Quillota"]),
    (7, "Región Metropolitana", ["Santiago", "Providencia", "Las Condes", "Ñuñoa", "Maipú", "La Florida", "Puente Alto", "Vitacura", "Recoleta"]),
    (8, "O'Higgins", ["Rancagua", "San Fernando", "Rengo", "Machalí"]),
    (9, "Maule", ["Talca", "Curicó", "Linares", "Cauquenes"]),
    (10, "Ñuble", ["Chillán", "Chillán Viejo", "San Carlos"]),
    (11, "Biobío", ["Concepción", "Talcahuano", "Los Ángeles", "Coronel", "San Pedro de la Paz"]),
    (12, "La Araucanía", ["Temuco", "Padre Las Casas", "Villarrica", "Angol", "Pucón"]),
    (13, "Los Ríos", ["Valdivia", "La Unión", "Río Bueno"]),
    (14, "Los Lagos", ["Puerto Montt", "Osorno", "Puerto Varas", "Castro", "Ancud"]),
    (15, "Aysén", ["Coyhaique", "Puerto Aysén"]),
    (16, "Magallanes", ["Punta Arenas", "Puerto Natales", "Porvenir"]),
]


class Command(BaseCommand):
    help = "Carga regiones y comunas de Chile (idempotente)."

    def handle(self, *args, **options):
        regions_created = cities_created = 0
        for order, region_name, comunas in REGIONS:
            region, r_new = Region.objects.update_or_create(
                slug=slugify(region_name),
                defaults={"name": region_name, "order": order},
            )
            regions_created += int(r_new)
            for comuna in comunas:
                _, c_new = City.objects.get_or_create(
                    region=region,
                    slug=slugify(comuna),
                    defaults={"name": comuna},
                )
                cities_created += int(c_new)

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed OK: {regions_created} regiones nuevas, {cities_created} comunas nuevas."
            )
        )
