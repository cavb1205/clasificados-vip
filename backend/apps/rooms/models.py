"""Clasificado de habitaciones disponibles.

Los anfitriones (rol `host`) publican habitaciones que solo pueden ver las
modelos activas. Modelo de negocio **plan por anfitrión**: el anfitrión compra
un plan (`SubscriptionPlan.kind=room_listing`) que define cuántas habitaciones
activas cubre (`max_listings`) y por cuánto tiempo. Con ese plan publica hasta
ese número de piezas (límite acotado además por `SiteConfig.max_active_rooms_per_host`).
Un plan con `max_listings>1` es un *bundle*: varias piezas con un solo pago.

Privacidad: nunca se guarda ni expone la dirección exacta (solo comuna + sector).
Las fotos van a almacenamiento privado y se sirven tras un gate; pasan por el
pipeline que elimina EXIF/GPS.
"""

from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import storages
from django.db import models
from django.utils import timezone

from apps.profiles.models import City, SiteConfig
from apps.publications.models import SubscriptionPlan


def _private_storage():
    """Callable para diferir la resolución del storage privado al runtime."""
    return storages["private"]


class HostProfile(models.Model):
    """Perfil del anfitrión (dueño de casa) y titular de la suscripción de habitaciones."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="host_profile"
    )
    display_name = models.CharField("nombre para mostrar", max_length=120)
    phone = models.CharField("teléfono", max_length=32, blank=True)
    whatsapp = models.CharField("WhatsApp", max_length=32, blank=True)

    # Suscripción vigente (snapshot del plan al aprobarse el pago, para que editar
    # el plan después no altere retroactivamente lo contratado).
    active_plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="host_subscriptions",
    )
    plan_expires_at = models.DateTimeField(null=True, blank=True)
    plan_slots = models.PositiveIntegerField("habitaciones contratadas", default=0)
    plan_featured = models.BooleanField("plan con destacado", default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.display_name} ({self.user.email})"

    @property
    def subscription_active(self) -> bool:
        return bool(self.plan_expires_at and self.plan_expires_at > timezone.now())

    def slots_cap(self) -> int:
        """Tope efectivo de piezas activas: lo contratado, acotado por el límite global."""
        if not self.subscription_active:
            return 0
        return min(self.plan_slots, SiteConfig.get().max_active_rooms_per_host)

    def used_slots(self) -> int:
        """Piezas que ocupan un cupo (publicadas, incl. pausadas; no las suspendidas)."""
        return self.listings.filter(
            status=RoomListing.Status.ACTIVE, is_suspended=False
        ).count()

    def available_slots(self) -> int:
        return max(0, self.slots_cap() - self.used_slots())

    def apply_plan(self, plan: SubscriptionPlan):
        """Activa/renueva la suscripción del anfitrión con el plan pagado.

        Sincroniza la vigencia y el destacado en las piezas ya publicadas para
        que reflejen el plan recién contratado.
        """
        self.active_plan = plan
        self.plan_slots = plan.max_listings
        self.plan_featured = plan.includes_featured
        self.plan_expires_at = timezone.now() + timedelta(days=plan.duration_days)
        self.save(
            update_fields=[
                "active_plan", "plan_slots", "plan_featured",
                "plan_expires_at", "updated_at",
            ]
        )
        self.listings.filter(status=RoomListing.Status.ACTIVE).update(
            expires_at=self.plan_expires_at,
            is_featured=self.plan_featured,
            updated_at=timezone.now(),
        )


class RoomListing(models.Model):
    """Anuncio de una habitación. Su vigencia la da la suscripción del anfitrión."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        ACTIVE = "active", "Publicada"
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

    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    is_featured = models.BooleanField("destacada", default=False)
    # Control del anfitrión: al ocuparse la pieza pausa el anuncio sin liberar el
    # cupo (sigue contando como publicada; puede reactivarlo).
    is_paused = models.BooleanField("pausado por el anfitrión", default=False)
    # Moderación administrativa (oculta el anuncio independientemente del pago).
    is_suspended = models.BooleanField("suspendido", default=False)
    suspension_reason = models.CharField(max_length=200, blank=True)

    # "Disponible ahora": fecha futura → badge verde + filtro ?available_now=true.
    # Lo activa el anfitrión para destacar la pieza por unas horas. Auto-expira.
    available_until = models.DateTimeField(null=True, blank=True)

    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_featured", "-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    @property
    def is_available_now(self) -> bool:
        return bool(self.available_until and self.available_until > timezone.now())

    @property
    def is_live(self) -> bool:
        """Visible para las modelos: publicada, no pausada, no suspendida y vigente."""
        return (
            self.status == self.Status.ACTIVE
            and not self.is_paused
            and not self.is_suspended
            and self.expires_at is not None
            and self.expires_at > timezone.now()
        )

    def publish(self):
        """Publica la pieza contra la suscripción del anfitrión (consume un cupo)."""
        host = self.owner
        self.status = self.Status.ACTIVE
        self.expires_at = host.plan_expires_at
        self.is_featured = host.plan_featured
        self.save(update_fields=["status", "expires_at", "is_featured", "updated_at"])

    def unpublish(self):
        """Vuelve la pieza a borrador y libera su cupo."""
        self.status = self.Status.DRAFT
        self.is_paused = False
        self.save(update_fields=["status", "is_paused", "updated_at"])


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
    """Comprobante que el anfitrión sube para contratar/renovar su plan."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de revisión"
        APPROVED = "approved", "Aprobado"
        REJECTED = "rejected", "Rechazado"

    owner = models.ForeignKey(
        HostProfile, on_delete=models.CASCADE, related_name="receipts"
    )
    plan = models.ForeignKey(
        SubscriptionPlan, on_delete=models.PROTECT, related_name="room_receipts"
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
        return f"Comprobante plan #{self.pk} ({self.status})"

    def approve(self, *, reviewer=None):
        self.status = self.Status.APPROVED
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        self.owner.apply_plan(self.plan)
        self._notify_owner(
            title="✅ Pago aprobado",
            message=f"Tu plan '{self.plan.name}' está activo hasta el "
                    f"{self.owner.plan_expires_at:%d-%m-%Y}. Ya puedes publicar "
                    f"hasta {self.owner.plan_slots} habitación(es).",
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
            message=note or "Revisa el comprobante de tu plan y vuelve a subirlo.",
        )

    def _notify_owner(self, *, title: str, message: str):
        from apps.notifications.models import Notification, notify_user
        notify_user(
            self.owner.user, kind=Notification.Kind.PAYMENT,
            title=title, message=message, link="/anfitrion",
        )


class RoomReport(models.Model):
    """Reporte de una habitación por contenido inapropiado. Cola de revisión admin."""

    listing = models.ForeignKey(
        RoomListing, on_delete=models.CASCADE, related_name="reports"
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="room_reports",
    )
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
