from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.profiles.models import ModelProfile


def profile_media_limits(profile) -> tuple[int, int]:
    """(máx fotos, máx videos) del perfil según su plan: destacado da más."""
    from django.utils import timezone

    from apps.publications.models import Publication

    featured = Publication.objects.filter(
        profile=profile,
        status=Publication.Status.ACTIVE,
        is_featured=True,
        expires_at__gt=timezone.now(),
    ).exists()
    if featured:
        return settings.MAX_PHOTOS_FEATURED, settings.MAX_VIDEOS_FEATURED
    return settings.MAX_PHOTOS_PER_PROFILE, settings.MAX_VIDEOS_PER_PROFILE


class MediaContent(models.Model):
    """Foto o video del perfil. Las fotos pasan por el pipeline de privacidad."""

    class MediaType(models.TextChoices):
        PHOTO = "photo", "Foto"
        VIDEO = "video", "Video"

    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="media"
    )
    media_type = models.CharField(max_length=5, choices=MediaType.choices)
    file = models.FileField(upload_to="profiles/media/")
    order = models.PositiveSmallIntegerField(default=0)
    is_hidden = models.BooleanField(
        "oculta por moderación", default=False,
        help_text="Si está activa, la pieza no se muestra en el perfil público.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.media_type} de {self.profile.stage_name}"

    def clean(self):
        """Valida los límites por perfil en backend (no solo en frontend)."""
        max_photos, max_videos = profile_media_limits(self.profile)
        if self.media_type == self.MediaType.PHOTO:
            limit, label = max_photos, "fotos"
        else:
            limit, label = max_videos, "videos"

        existing = MediaContent.objects.filter(
            profile=self.profile, media_type=self.media_type
        ).exclude(pk=self.pk).count()
        if existing >= limit:
            raise ValidationError(
                f"Límite alcanzado: máximo {limit} {label} por perfil."
            )
