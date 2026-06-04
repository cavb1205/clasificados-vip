from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from django.utils.text import slugify

from apps.profiles.models import ModelProfile

# Duración por defecto si una publicación no tiene plan asignado (compatibilidad).
PUBLICATION_DAYS = 30


class SubscriptionPlan(models.Model):
    """Plan de publicación configurable por el admin (diario, semanal, mensual, etc.).

    La duración es libre (en días), así el admin puede crear cualquier periodicidad
    sin tocar código: 1 día, 7 días, 30 días, 90 días...
    """

    class Kind(models.TextChoices):
        MODEL_PUBLICATION = "model_publication", "Publicación de modelo"
        ROOM_LISTING = "room_listing", "Anuncio de habitación"

    name = models.CharField("nombre", max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True, blank=True)
    kind = models.CharField(
        "tipo de plan",
        max_length=20,
        choices=Kind.choices,
        default=Kind.MODEL_PUBLICATION,
        help_text="Para qué clasificado aplica el plan (publicación de modelo o habitación).",
    )
    duration_days = models.PositiveIntegerField(
        "duración (días)", help_text="Días que dura la publicación activa con este plan."
    )
    max_listings = models.PositiveIntegerField(
        "habitaciones incluidas",
        default=1,
        help_text=(
            "Solo planes de habitación: cuántos anuncios activos cubre el plan. "
            "1 = un anuncio; >1 = bundle (varias piezas con un solo pago)."
        ),
    )
    price = models.PositiveIntegerField("precio (CLP)")
    includes_featured = models.BooleanField(
        "incluye destacado", default=False, help_text="Si el plan publica el anuncio como destacado."
    )
    is_active = models.BooleanField("disponible", default=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "duration_days"]

    def __str__(self) -> str:
        return f"{self.name} ({self.duration_days}d · ${self.price})"

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)


class Publication(models.Model):
    """Anuncio de un perfil. Controla su visibilidad y vigencia."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        PENDING_PAYMENT = "pending_payment", "Pendiente de pago"
        ACTIVE = "active", "Activa"
        EXPIRED = "expired", "Expirada"

    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="publications"
    )
    plan = models.ForeignKey(
        SubscriptionPlan,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="publications",
        help_text="Plan elegido; define la duración al activarse.",
    )
    title = models.CharField(max_length=160)
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.DRAFT
    )
    is_featured = models.BooleanField("destacada", default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-is_featured", "-created_at"]

    def __str__(self) -> str:
        return f"{self.title} ({self.status})"

    @property
    def is_live(self) -> bool:
        return (
            self.status == self.Status.ACTIVE
            and self.expires_at is not None
            and self.expires_at > timezone.now()
        )

    def activate(self, *, days: int | None = None):
        """Activa la publicación y fija la expiración según el plan elegido.

        Si se pasa `days` explícito, prima. Si no, usa la duración del plan; y si
        no hay plan, cae al valor por defecto `PUBLICATION_DAYS`.
        """
        if days is None:
            days = self.plan.duration_days if self.plan else PUBLICATION_DAYS
        self.status = self.Status.ACTIVE
        self.expires_at = timezone.now() + timedelta(days=days)
        if self.plan and self.plan.includes_featured:
            self.is_featured = True
        self.save(update_fields=["status", "expires_at", "is_featured", "updated_at"])

    def extend(self, *, days: int):
        """Suma días de cortesía/extensión (admin).

        Si la publicación sigue viva, parte de su expiración actual; si está
        vencida o nunca activada, parte de ahora. Deja el anuncio activo.
        """
        base = self.expires_at if (self.is_live and self.expires_at) else timezone.now()
        self.status = self.Status.ACTIVE
        self.expires_at = base + timedelta(days=days)
        self.save(update_fields=["status", "expires_at", "updated_at"])


class PaymentReceipt(models.Model):
    """Comprobante de transferencia que la modelo sube para una publicación."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pendiente de revisión"
        APPROVED = "approved", "Aprobado"
        REJECTED = "rejected", "Rechazado"

    publication = models.ForeignKey(
        Publication, on_delete=models.CASCADE, related_name="receipts"
    )
    image = models.ImageField(upload_to="receipts/")
    amount = models.PositiveIntegerField("monto declarado (CLP)", null=True, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reviewed_receipts",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Comprobante #{self.pk} ({self.status})"

    def approve(self, *, reviewer=None):
        """Aprueba el pago y activa la publicación asociada."""
        self.status = self.Status.APPROVED
        self.reviewed_by = reviewer
        self.reviewed_at = timezone.now()
        self.save(update_fields=["status", "reviewed_by", "reviewed_at"])
        self.publication.activate()
        self._notify_owner(
            title="✅ Pago aprobado",
            message=f"Tu anuncio '{self.publication.title}' ya está activo "
                    f"hasta el {self.publication.expires_at:%d-%m-%Y}.",
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
            message=note or f"Revisa el comprobante de '{self.publication.title}' y vuelve a subirlo.",
        )

    def _notify_owner(self, *, title: str, message: str):
        # Import perezoso para evitar ciclos a nivel de módulo.
        from apps.notifications.models import Notification, notify_user
        notify_user(
            self.publication.profile.user, kind=Notification.Kind.PAYMENT,
            title=title, message=message, link="/dashboard",
        )
