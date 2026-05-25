from django.conf import settings
from django.db import models


class Notification(models.Model):
    """Mensaje in-dashboard para un usuario.

    Se crea desde acciones del admin (aprobar/rechazar KYC, pago, reseña) y se
    consume desde el panel de la modelo. El campo `link` es opcional y permite
    enlazar al recurso afectado (publicación, reseña, etc.).
    """

    class Kind(models.TextChoices):
        KYC = "kyc", "KYC"
        PAYMENT = "payment", "Pago"
        PUBLICATION = "publication", "Publicación"
        REVIEW = "review", "Reseña"
        GENERIC = "generic", "Aviso"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    kind = models.CharField(max_length=12, choices=Kind.choices, default=Kind.GENERIC)
    title = models.CharField(max_length=140)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=240, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["recipient", "read_at"])]

    def __str__(self) -> str:
        return f"{self.kind} → {self.recipient}: {self.title}"

    @property
    def is_read(self) -> bool:
        return self.read_at is not None


def notify_user(user, *, kind: str, title: str, message: str = "", link: str = "") -> Notification:
    """Helper único para crear notificaciones desde cualquier app."""
    return Notification.objects.create(
        recipient=user, kind=kind, title=title, message=message, link=link
    )
