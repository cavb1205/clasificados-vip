from django.db import migrations, models

import apps.media_content.models


class Migration(migrations.Migration):

    dependencies = [
        ("media_content", "0003_mediacontent_is_hidden"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediacontent",
            name="file",
            field=models.FileField(
                storage=apps.media_content.models._private_storage,
                upload_to="profiles/media/",
            ),
        ),
    ]
