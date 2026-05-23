from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.db import models

from core.encryption import decrypt_bytes, encrypt_bytes


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
