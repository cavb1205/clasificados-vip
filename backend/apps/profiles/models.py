from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Region(models.Model):
    """Región administrativa de Chile (16 en total)."""

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    order = models.PositiveSmallIntegerField(default=0, help_text="Orden geográfico N→S")

    class Meta:
        ordering = ["order", "name"]

    def __str__(self) -> str:
        return self.name


class City(models.Model):
    """Comuna de Chile, perteneciente a una región."""

    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="cities")
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)

    class Meta:
        verbose_name_plural = "cities"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["region", "slug"], name="uniq_city_region_slug"),
        ]

    def __str__(self) -> str:
        return f"{self.name}, {self.region.name}"


class Service(models.Model):
    """Catálogo de etiquetas (servicios, extras, características físicas).

    Una sola tabla para los tres tipos, diferenciados por `category`. El admin
    gestiona el catálogo desde el panel y agrega nuevas etiquetas sin migración.
    """

    class Category(models.TextChoices):
        SERVICE = "service", "Servicio"      # masaje, cena, compañía…
        EXTRA = "extra", "Extra"             # duo, salidas, viajes…
        FEATURE = "feature", "Característica"  # rubia, tatuajes, delgada…

    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    category = models.CharField(
        max_length=10, choices=Category.choices, default=Category.SERVICE
    )
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["category", "order", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.category})"


class ModelProfile(models.Model):
    """Perfil público de una modelo. Nace 'pending' e invisible hasta verificación."""

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pendiente"
        VERIFIED = "verified", "Verificado"
        REJECTED = "rejected", "Rechazado"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="model_profile"
    )
    stage_name = models.CharField("nombre artístico", max_length=120)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    age = models.PositiveSmallIntegerField(help_text="Edad verificada (18+)")
    services = models.ManyToManyField(Service, related_name="profiles", blank=True)
    base_rate = models.PositiveIntegerField("tarifa base (CLP)", null=True, blank=True)
    # Canales de contacto. Solo se exponen públicamente para perfiles verificados.
    # El frontend los oculta detrás de un botón "Contactar" para frenar scraping casual.
    whatsapp = models.CharField(
        "WhatsApp",
        max_length=20,
        blank=True,
        help_text="Solo dígitos en formato internacional (ej: 56912345678).",
    )
    telegram = models.CharField(
        "Telegram",
        max_length=40,
        blank=True,
        help_text="Usuario sin @, o link t.me/usuario.",
    )
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, related_name="profiles"
    )
    verification_status = models.CharField(
        max_length=10,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    # Marca la primera aprobación de KYC. Inmutable a re-aprobaciones.
    # Sirve de ancla para calcular el periodo de trial gratuito.
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.stage_name} ({self.verification_status})"

    @property
    def is_verified(self) -> bool:
        return self.verification_status == self.VerificationStatus.VERIFIED

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.stage_name) or "perfil"
            slug, n = base, 1
            while ModelProfile.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)


class ProfileEvent(models.Model):
    """Eventos anónimos para estadísticas del perfil.

    No guardamos IP ni user-agent para minimizar datos sensibles: solo el tipo
    de evento y el timestamp bastan para los contadores que necesita la modelo.
    """

    class Kind(models.TextChoices):
        VIEW = "view", "Visita"
        CONTACT = "contact", "Click contacto"

    profile = models.ForeignKey(ModelProfile, on_delete=models.CASCADE, related_name="events")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["profile", "kind", "created_at"])]


class SiteConfig(models.Model):
    """Configuración global del sitio editable desde el admin (singleton).

    Solo existe un registro (pk=1). Para leerla:
        config = SiteConfig.get()
    """

    trial_days = models.PositiveIntegerField(
        "días de trial gratuito post-KYC",
        default=1,
        help_text=(
            "Tras aprobar el KYC, el perfil queda visible públicamente sin "
            "pago durante este número de días. Pasado ese periodo se exige "
            "una publicación active."
        ),
    )

    class Meta:
        verbose_name = "Configuración del sitio"
        verbose_name_plural = "Configuración del sitio"

    @classmethod
    def get(cls) -> "SiteConfig":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        self.pk = 1  # forzar singleton
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return "Configuración del sitio"
