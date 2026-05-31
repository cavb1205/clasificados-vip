"""Clasificado de habitaciones disponibles.

Los anfitriones (rol `host`) publican habitaciones que solo pueden ver las
modelos activas. Reutiliza el patrón de `apps.publications`: plan + comprobante
de pago + activación con vencimiento. Decisiones de privacidad:

- Nunca se guarda ni se expone la dirección exacta: solo ciudad (comuna) y un
  sector opcional de texto libre.
- Las fotos van a almacenamiento privado y se sirven tras un gate (no por
  `MEDIA_URL`); además pasan por el pipeline que elimina EXIF/GPS.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import storages
from django.db import models
from django.utils import timezone

from apps.profiles.models import City
from apps.publications.models import SubscriptionPlan

# Duración por defecto si un anuncio no tiene plan asignado (compatibilidad).
ROOM_LISTING_DAYS = 30


def _private_storage():
    """Callable para diferir la resolución del storage privado al runtime."""
    return storages["private"]


class HostProfile(models.Model):
    """Perfil ligero del anfitrión (dueño de casa). No requiere KYC."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="host_profile"
    )
    display_name = models.CharField("nombre para mostrar", max_length=120)
    phone = models.CharField("teléfono", max_length=32, blank=True)
    whatsapp = models.CharField("WhatsApp", max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.display_name} ({self.user.email})"


class RoomListing(models.Model):
    """Anuncio de una habitación disponible. Controla visibilidad y vigencia."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        PENDING_PAYMENT = "pending_payment", "Pendiente de pago"
        ACTIVE = "active", "Activa"
        EXPIRED = "expired", "Expirada"

    class PricePeriod(models.TextChoices):
        DAILY = "daily", "Diario"
        WEEKLY = "weekly", "Semanal"
        MONTHLY = "monthly", "Mensual"

    owner = models.ForeignKey(
        HostProfile, on_delete=models.CASCADE, related_name="listings"
    )
    # Granularidad máxima = comuna. Nunca se guarda la dirección exacta.
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, related_name="room_listings"
    )
    sector = models.CharField(
        "sector", max_length=80, blank=True,
        help_text="Referencia general (ej: 'centro', 'sector norte'). Sin calle ni número.",
    )
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    price = models.PositiveIntegerField("precio (CLP)")
    price_period = models.CharField(
        "periodo", max_length=10, choices=PricePeriod.choices, default=PricePeriod.MONTHLY
    )
    # Contacto del anuncio: se prellena desde el HostProfile pero es editable.
    whatsapp = models.CharField("WhatsApp", max_length=32, blank=True)
    phone = models.CharField("teléfono", max_length=32, blank=True)

    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="room_listings",
        help_text="Plan elegido; define la duración al activarse.",
    )
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    # Control del anfitrión: al ocuparse la pieza pausa el anuncio sin perder
    # la vigencia pagada; puede reactivarlo mientras no expire.
    is_paused = models.BooleanField("pausado por el anfitrión", default=False)
    # Moderación administrativa (oculta el anuncio independientemente del pago).
    is_suspended = models.BooleanField("suspendido", default=False)
    suspension_reason = models.CharField(max_length=200, blank=True)

    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    @property
    def is_live(self) -> bool:
        """Visible para las modelos: activa, no pausada, no suspendida y vigente."""
        return (
            self.status == self.Status.ACTIVE
            and not self.is_paused
            and not self.is_suspended
            and self.expires_at is not None
            and self.expires_at > timezone.now()
        )

    def activate(self, *, days: int | None = None):
        """Activa el anuncio y fija la expiración según el plan elegido."""
        if days is None:
            days = self.plan.duration_days if self.plan else ROOM_LISTING_DAYS
        self.status = self.Status.ACTIVE
        self.expires_at = timezone.now() + timedelta(days=days)
        self.save(update_fields=["status", "expires_at", "updated_at"])


class RoomPhoto(models.Model):
    """Foto de una habitación. Almacenamiento privado + EXIF/GPS eliminados."""

    listing = models.ForeignKey(
        RoomListing, on_delete=models.CASCADE, related_name="photos"
    )
    # Storage privado: la URL pública no existe; se sirve por una vista gateada.
    image = models.ImageField(upload_to="rooms/", storage=_private_storage)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    def __str__(self) -> str:
        return f"Foto de {self.listing.title}"

    def clean(self):
        limit = settings.MAX_PHOTOS_PER_ROOM
        existing = (
            RoomPhoto.objects.filter(listing=self.listing)
            .exclude(pk=self.pk)
            .count()
        )
        if existing >= limit:
            raise ValidationError(
                f"Límite alcanzado: máximo {limit} fotos por habitación."
            )


class RoomReceipt(models.Model):
    """Comprobante de transferencia que el anfitrión sube para un anuncio."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de revisión"
        APPROVED = "approved", "Aprobado"
        REJECTED = "rejected", "Rechazado"

    listing = models.ForeignKey(
        RoomListing, on_delete=models.CASCADE, related_name="receipts"
    )
    image = models.ImageField(upload_to="room_receipts/")
    amount = models.PositiveIntegerField("monto declarado (CLP)", null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_room_receipts",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Comprobante habitación #{self.pk} ({self.status})"

    def approve(self, *, reviewer=None):
        self.status = self.Status.APPROVED
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        self.listing.activate()
        self._notify_owner(
            title="✅ Pago aprobado",
            message=f"Tu habitación '{self.listing.title}' ya está publicada "
                    f"hasta el {self.listing.expires_at:%d-%m-%Y}.",
        )

    def reject(self, *, reviewer=None, note=""):
        self.status = self.Status.REJECTED
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        if note:
            self.note = note
        self.save(update_fields=["status", "reviewed_by", "reviewed_at", "note"])
        self._notify_owner(
            title="Comprobante rechazado",
            message=note or f"Revisa el comprobante de '{self.listing.title}' y vuelve a subirlo.",
        )

    def _notify_owner(self, *, title: str, message: str):
        from apps.notifications.models import Notification, notify_user
        notify_user(
            self.listing.owner.user, kind=Notification.Kind.PAYMENT,
            title=title, message=message, link="/anfitrion",
        )
