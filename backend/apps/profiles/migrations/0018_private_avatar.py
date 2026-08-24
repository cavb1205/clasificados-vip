from django.db import migrations, models

import apps.profiles.models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0017_siteconfig_referral_bonus_days"),
    ]

    operations = [
        migrations.AlterField(
            model_name="modelprofile",
            name="avatar",
            field=models.ImageField(
                blank=True,
                null=True,
                storage=apps.profiles.models._private_storage,
                upload_to="profiles/avatars/",
                verbose_name="foto de perfil",
            ),
        ),
    ]
