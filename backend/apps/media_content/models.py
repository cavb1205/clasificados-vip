from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.profiles.models import ModelProfile


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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"{self.media_type} de {self.profile.stage_name}"

    def clean(self):
        """Valida los límites por perfil en backend (no solo en frontend)."""
        if self.media_type == self.MediaType.PHOTO:
            limit = settings.MAX_PHOTOS_PER_PROFILE
            label = "fotos"
        else:
            limit = settings.MAX_VIDEOS_PER_PROFILE
            label = "videos"

        existing = MediaContent.objects.filter(
            profile=self.profile, media_type=self.media_type
        ).exclude(pk=self.pk).count()
        if existing >= limit:
            raise ValidationError(
                f"Límite alcanzado: máximo {limit} {label} por perfil."
            )
