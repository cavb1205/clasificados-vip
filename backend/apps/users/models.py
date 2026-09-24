from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class CustomUser(AbstractUser):
    """Usuario base con rol. El email es obligatorio y único (login por email)."""

    class Role(models.TextChoices):
        MODEL = "model", "Modelo"
        CLIENT = "client", "Cliente"
        # Anfitrión: dueño de casa que publica habitaciones (apps.rooms). No
        # requiere KYC de modelo; su registro es liviano.
        HOST = "host", "Anfitrión"
        # Moderador: puede revisar reseñas, reportes y ver listados, pero NO
        # acciones sensibles (KYC, pagos, planes, suspender, auditoría).
        MODERATOR = "moderator", "Moderador"
        ADMIN = "admin", "Administrador"

    email = models.EmailField("correo electrónico", unique=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.CLIENT)
    email_verified = models.BooleanField(default=False)
    # Incrementar este valor invalida todos los JWT emitidos anteriormente para
    # la cuenta (por ejemplo, después de cambiar o resetear la contraseña).
    session_version = models.PositiveIntegerField(default=0)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"


class LegalAcceptance(models.Model):
    """Versioned evidence of terms acceptance and privacy-notice acknowledgment.

    Deliberately does not store the request IP: the acceptance can be audited
    by account, role, timestamp, and document version without retaining an
    additional identifying signal.
    """

    class Source(models.TextChoices):
        REGISTRATION = "registration", "Registro"
        ACCOUNT = "account", "Mi cuenta"

    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="legal_acceptances"
    )
    role = models.CharField(max_length=12)
    terms_version = models.CharField(max_length=40)
    privacy_version = models.CharField(max_length=40)
    source = models.CharField(max_length=16, choices=Source.choices)
    accepted_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        ordering = ["-accepted_at", "-pk"]
        indexes = [models.Index(fields=["user", "-accepted_at"])]

    def __str__(self) -> str:
        return f"{self.user_id} · {self.terms_version}/{self.privacy_version}"


class PrivacyRequest(models.Model):
    """Authenticated channel for data-subject requests; staff records outcome."""

    class RequestType(models.TextChoices):
        ACCESS = "access", "Acceso o copia"
        RECTIFICATION = "rectification", "Rectificación"
        ERASURE = "erasure", "Eliminación/cancelación"
        OPPOSITION = "opposition", "Oposición o retiro de consentimiento"
        OTHER = "other", "Otra solicitud de privacidad"

    class Status(models.TextChoices):
        OPEN = "open", "Abierta"
        IN_REVIEW = "in_review", "En revisión"
        COMPLETED = "completed", "Resuelta"
        DENIED = "denied", "No procede"

    user = models.ForeignKey(
        CustomUser, on_delete=models.CASCADE, related_name="privacy_requests"
    )
    request_type = models.CharField(max_length=20, choices=RequestType.choices)
    details = models.TextField(blank=True)
    resolution_notes = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    handled_by = models.ForeignKey(
        CustomUser,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="handled_privacy_requests",
    )
    handled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        super().clean()
        if self.status in {self.Status.COMPLETED, self.Status.DENIED} and not self.resolution_notes.strip():
            raise ValidationError({
                "resolution_notes": "Registra qué acción se realizó o por qué la solicitud no procede."
            })

    def __str__(self) -> str:
        return f"{self.get_request_type_display()} · {self.user_id} · {self.get_status_display()}"
