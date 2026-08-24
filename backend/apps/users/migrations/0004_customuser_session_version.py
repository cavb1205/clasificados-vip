from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0003_alter_customuser_role"),
    ]

    operations = [
        migrations.AddField(
            model_name="customuser",
            name="session_version",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
