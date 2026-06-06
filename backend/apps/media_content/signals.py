"""Cuando la modelo agrega o borra una foto del muro, la insignia de
autenticidad (retoque) vuelve a 'Por revisar' para que el admin la re-evalúe."""

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.profiles.models import ModelProfile
from .models import MediaContent


def _reset_authenticity(profile):
    if profile and profile.photo_authenticity != ModelProfile.PhotoAuthenticity.PENDING:
        ModelProfile.objects.filter(pk=profile.pk).update(
            photo_authenticity=ModelProfile.PhotoAuthenticity.PENDING
        )


@receiver(post_save, sender=MediaContent)
def on_media_created(sender, instance, created, **kwargs):
    # Solo al CREAR una foto nueva (reordenar/ocultar son save sin created).
    if created and instance.media_type == MediaContent.MediaType.PHOTO:
        _reset_authenticity(instance.profile)


@receiver(post_delete, sender=MediaContent)
def on_media_deleted(sender, instance, **kwargs):
    if instance.media_type == MediaContent.MediaType.PHOTO:
        _reset_authenticity(instance.profile)
