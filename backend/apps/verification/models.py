import secrets
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.db import models
from django.utils import timezone

from core.encryption import decrypt_bytes, encrypt_bytes

CHALLENGE_TTL_MINUTES = 60


def _private_storage():
    return storages["private"]


class VerificationRequest(models.Model):
    """Solicitud KYC. La cédula y la selfie se guardan CIFRADAS en el almacén privado.

    Los archivos nunca se sirven públicamente: solo un admin puede descifrarlos
    en memoria vía la vista protegida, y cada acceso queda registrado en
    VerificationAccessLog.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente"
        VERIFIED = "verified", "Verificado"
        REJECTED = "rejected", "Rechazado"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="verification_requests"
    )
    id_document = models.FileField(storage=_private_storage, upload_to="kyc/id/")
    selfie = models.FileField(storage=_private_storage, upload_to="kyc/selfie/")
    # Video corto donde la modelo lee la frase de consentimiento con el código
    # de desafío. Igual que id/selfie, va cifrado en el storage privado.
    consent_video = models.FileField(
        storage=_private_storage, upload_to="kyc/video/", blank=True
    )
    # Código de desafío que se mostró al momento de grabar (auditoría).
    challenge_code = models.CharField(max_length=10, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_verifications",
    )
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"KYC {self.user} ({self.status})"

    def store_encrypted(self, field_name: str, raw_bytes: bytes, *, ext: str = "enc"):
        """Cifra `raw_bytes` y los guarda en el FileField indicado."""
        field = getattr(self, field_name)
        token = encrypt_bytes(raw_bytes)
        field.save(f"{field_name}.{ext}", ContentFile(token), save=False)

    def read_decrypted(self, field_name: str) -> bytes:
        """Devuelve los bytes originales descifrados (uso solo admin/auditado)."""
        field = getattr(self, field_name)
        with field.open("rb") as fh:
            return decrypt_bytes(fh.read())


class VerificationAccessLog(models.Model):
    """Auditoría: quién accedió a un documento KYC descifrado y cuándo."""

    request = models.ForeignKey(
        VerificationRequest, on_delete=models.CASCADE, related_name="access_logs"
    )
    accessed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    field_name = models.CharField(max_length=32)
    accessed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-accessed_at"]


def _generate_challenge_code() -> str:
    """Genera 'AZUL-7K' style: 4 letras + dash + 2 alfanuméricos.

    Evita caracteres ambiguos (0/O/1/I/L) para que sea fácil de leer en voz alta.
    """
    alpha = "ABCDEFGHJKMNPQRSTUVWXYZ"
    alnum = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alpha) for _ in range(4)) + "-" + "".join(
        secrets.choice(alnum) for _ in range(2)
    )


class VerificationChallenge(models.Model):
    """Código aleatorio que el usuario debe leer en el video de consentimiento.

    Probar frescura del video (impide reusar grabaciones viejas o deepfakes
    pre-renderizados). Vida útil corta (1h) y de un solo uso.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="kyc_challenges"
    )
    code = models.CharField(max_length=10, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @classmethod
    def issue(cls, user) -> "VerificationChallenge":
        """Invalida códigos previos del usuario y emite uno nuevo."""
        now = timezone.now()
        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=now)
        # Reintenta si por casualidad colisiona con uno existente (muy poco probable).
        for _ in range(5):
            code = _generate_challenge_code()
            if not cls.objects.filter(code=code).exists():
                return cls.objects.create(
                    user=user, code=code,
                    expires_at=now + timedelta(minutes=CHALLENGE_TTL_MINUTES),
                )
        raise RuntimeError("No se pudo generar un código único.")

    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()

    def consume(self):
        self.used_at = timezone.now()
        self.save(update_fields=["used_at"])
