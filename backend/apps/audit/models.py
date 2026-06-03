from django.conf import settings
from django.db import models


class AdminActionLog(models.Model):
    """Registro de acciones sensibles del staff (accountability con moderadores).

    No reemplaza al `VerificationAccessLog` del KYC (acceso a documentos); este
    registra QUÉ acción de moderación/cobro hizo QUIÉN y cuándo.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="admin_actions",
    )
    action = models.CharField(max_length=50)  # ej: "payment.approve", "model.suspend"
    target = models.CharField(max_length=200, blank=True)  # etiqueta legible
    note = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["action", "created_at"])]

    def __str__(self) -> str:
        return f"{self.actor} · {self.action} · {self.target}"


def log_action(actor, action: str, target="", note=""):
    """Helper para registrar una acción admin. Tolerante (nunca rompe la acción)."""
    try:
        AdminActionLog.objects.create(
            actor=actor if getattr(actor, "is_authenticated", False) else None,
            action=action[:50],
            target=str(target)[:200],
            note=str(note)[:300],
        )
    except Exception:  # pragma: no cover — auditar nunca debe tumbar la operación
        pass
