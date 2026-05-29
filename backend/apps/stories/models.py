from datetime import timedelta

from django.db import models
from django.utils import timezone

from apps.profiles.models import ModelProfile

STORY_TTL_HOURS = 24
MAX_STORIES_ALIVE = 5  # tope simultáneo por perfil


def _expires_default():
    return timezone.now() + timedelta(hours=STORY_TTL_HOURS)


class Story(models.Model):
    """Publicación efímera de 24h. Solo para perfiles destacados.

    Sin moderación previa (auto-publica). Backup de seguridad: botón Reportar
    en el viewer + admin take-down inmediato. Cron 'delete_expired_stories'
    borra archivo del disco y la fila al pasar el TTL.
    """

    class Kind(models.TextChoices):
        PHOTO = "photo", "Foto"
        VIDEO = "video", "Video"

    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="stories"
    )
    kind = models.CharField(max_length=5, choices=Kind.choices)
    file = models.FileField(upload_to="stories/")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=_expires_default)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["expires_at"])]

    def __str__(self) -> str:
        return f"Story de {self.profile.stage_name} ({self.kind}) hasta {self.expires_at:%Y-%m-%d %H:%M}"

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()


class StoryReport(models.Model):
    """Reporte de una story por parte del público. Acumulación → revisión admin."""

    story = models.ForeignKey(Story, on_delete=models.CASCADE, related_name="reports")
    reason = models.CharField(max_length=200, blank=True)
    # Reporter puede no estar logueado; guardamos solo timestamp + razón.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
