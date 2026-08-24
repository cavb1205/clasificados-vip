from django.db import migrations, models

import apps.stories.models


class Migration(migrations.Migration):

    dependencies = [
        ("stories", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="story",
            name="file",
            field=models.FileField(
                storage=apps.stories.models._private_storage,
                upload_to="stories/",
            ),
        ),
    ]
