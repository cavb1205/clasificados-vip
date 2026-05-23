from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.profiles.models import ModelProfile


class Review(models.Model):
    """Calificación de un cliente a un perfil. Moderada antes de publicarse.

    Un cliente solo puede dejar una reseña por perfil (anti review-bombing).
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de moderación"
        APPROVED = "approved", "Aprobada"
        REJECTED = "rejected", "Rechazada"

    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="reviews"
    )
    client = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reviews"
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    comment = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["profile", "client"], name="uniq_review_per_client_profile"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rating}★ de {self.client} a {self.profile.stage_name}"
