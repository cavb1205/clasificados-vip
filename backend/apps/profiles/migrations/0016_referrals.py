import uuid

from django.db import migrations, models
import django.db.models.deletion


def populate_codes(apps, schema_editor):
    ModelProfile = apps.get_model("profiles", "ModelProfile")
    used = set(
        ModelProfile.objects.exclude(referral_code="").values_list("referral_code", flat=True)
    )
    for p in ModelProfile.objects.filter(referral_code=""):
        code = uuid.uuid4().hex[:8]
        while code in used:
            code = uuid.uuid4().hex[:8]
        used.add(code)
        p.referral_code = code
        p.save(update_fields=["referral_code"])


class Migration(migrations.Migration):

    dependencies = [
        ('profiles', '0015_modelprofile_photo_authenticity'),
    ]

    operations = [
        migrations.AddField(
            model_name='modelprofile',
            name='referral_bonus_until',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Se agrega sin unique/índice para poder poblar los existentes; luego se hace
        # unique (que crea el índice). Si se pone db_index aquí, el _like se crearía dos
        # veces (aquí y en el AlterField unique) → "relation ..._like already exists".
        migrations.AddField(
            model_name='modelprofile',
            name='referral_code',
            field=models.CharField(blank=True, default='', max_length=12),
        ),
        migrations.AddField(
            model_name='modelprofile',
            name='referral_rewarded',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='modelprofile',
            name='referred_by',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='referrals', to='profiles.modelprofile'),
        ),
        migrations.RunPython(populate_codes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='modelprofile',
            name='referral_code',
            field=models.CharField(blank=True, max_length=12, unique=True),
        ),
    ]
