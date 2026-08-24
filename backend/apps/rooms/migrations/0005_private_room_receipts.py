from django.db import migrations, models

import apps.rooms.models


class Migration(migrations.Migration):

    dependencies = [
        ("rooms", "0004_hostprofile_is_suspended_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="roomreceipt",
            name="image",
            field=models.ImageField(
                storage=apps.rooms.models._private_storage,
                upload_to="room_receipts/",
            ),
        ),
    ]
