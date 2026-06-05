import sys

from django.db import migrations


# Planes de publicación para modelos (PortalVip). Precios justos/competitivos
# vs. el mercado chileno (muy por debajo de SexoSur: $50-90k + VIP $30k/día).
# Editables después desde /admin/config.
#   (name, slug, price, duration_days, includes_featured, order)
NEW_PLANS = [
    ("Semanal", "semanal", 6000, 7, False, 0),
    ("Básico mensual", "basico-mensual", 15000, 30, False, 1),
    ("Destacado mensual", "destacado-mensual", 30000, 30, True, 2),
]


def seed_plans(apps, schema_editor):
    # No sembrar durante los tests: la suite crea sus propios planes (algunos con
    # el mismo nombre) y espera una tabla limpia.
    if "test" in sys.argv:
        return
    Plan = apps.get_model("publications", "SubscriptionPlan")
    # Saca del menú los planes de modelo actuales (los viejos/caros). NO se
    # borran: las publicaciones existentes conservan su plan (FK PROTECT) y el
    # admin puede reactivar cualquiera desde /admin/config.
    Plan.objects.filter(kind="model_publication").update(is_active=False)

    # Crea o actualiza los nuevos (por slug → idempotente y sin duplicar el
    # "Semanal" que ya existía).
    for name, slug, price, days, feat, order in NEW_PLANS:
        obj = (
            Plan.objects.filter(slug=slug).first()
            or Plan.objects.filter(name=name).first()
        )
        fields = dict(
            name=name, slug=slug, kind="model_publication",
            duration_days=days, max_listings=1, price=price,
            includes_featured=feat, is_active=True, order=order,
        )
        if obj:
            for k, v in fields.items():
                setattr(obj, k, v)
            obj.save()
        else:
            Plan.objects.create(**fields)


def unseed_plans(apps, schema_editor):
    # Reversa best-effort: elimina los dos planes mensuales nuevos. (La
    # desactivación de los viejos no se revierte automáticamente.)
    Plan = apps.get_model("publications", "SubscriptionPlan")
    Plan.objects.filter(slug__in=["basico-mensual", "destacado-mensual"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("publications", "0004_subscriptionplan_max_listings"),
    ]

    operations = [
        migrations.RunPython(seed_plans, unseed_plans),
    ]
