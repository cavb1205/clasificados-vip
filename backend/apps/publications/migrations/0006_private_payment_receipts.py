from django.db import migrations, models

import apps.publications.models


class Migration(migrations.Migration):

    dependencies = [
        ("publications", "0005_seed_model_plans"),
    ]

    operations = [
        migrations.AlterField(
            model_name="paymentreceipt",
            name="image",
            field=models.ImageField(
                storage=apps.publications.models._private_storage,
                upload_to="receipts/",
            ),
        ),
    ]
