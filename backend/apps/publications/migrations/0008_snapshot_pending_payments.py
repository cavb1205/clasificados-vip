from django.db import migrations


def preserve_pending_terms(apps, schema_editor):
    # Solo se conocen las condiciones actuales de los pagos pendientes.
    # No inventar condiciones históricas de recibos ya aprobados/rechazados.
    for app, model, relation in (
        ("publications", "PaymentReceipt", "publication__plan"),
        ("rooms", "RoomReceipt", "plan"),
    ):
        receipts = apps.get_model(app, model).objects.using(schema_editor.connection.alias)
        for receipt in receipts.filter(status="pending").select_related(relation).iterator():
            plan = receipt.publication.plan if app == "publications" else receipt.plan
            terms = {"duration_days": 30, "includes_featured": False, "price": None}
            if plan is not None:
                terms = {
                    "id": plan.pk, "name": plan.name, "price": plan.price,
                    "duration_days": plan.duration_days,
                    "includes_featured": plan.includes_featured,
                    "max_listings": plan.max_listings,
                }
            receipts.filter(pk=receipt.pk).update(plan_snapshot=terms)


class Migration(migrations.Migration):
    dependencies = [
        ("publications", "0007_paymentreceipt_plan_snapshot"),
        ("rooms", "0006_roomreceipt_plan_snapshot"),
    ]
    operations = [migrations.RunPython(preserve_pending_terms, migrations.RunPython.noop)]
