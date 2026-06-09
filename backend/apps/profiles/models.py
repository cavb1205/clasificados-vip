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


class ModelProfileQuerySet(models.QuerySet):
    """QuerySet con la regla de visibilidad pública centralizada.

    Antes esta lógica estaba duplicada en varias vistas. Ahora vive en un solo
    lugar y la reutilizan tanto el portal público como el gate de habitaciones
    (`apps.rooms`): una modelo "activa" es la que puede ver las habitaciones.
    """

    def publicly_visible(self):
        """Perfiles verificados, no suspendidos y en trial o con publicación activa.

        Puede devolver duplicados por el JOIN con publications; el llamador debe
        aplicar `.distinct()` cuando recorra los resultados (no hace falta para
        `.exists()`).
        """
        from datetime import timedelta

        from django.utils import timezone

        from apps.publications.models import Publication

        now = timezone.now()
        trial_cutoff = now - timedelta(days=SiteConfig.get().trial_days)
        return self.filter(
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            is_suspended=False,
        ).filter(
            models.Q(verified_at__gte=trial_cutoff)
            | models.Q(referral_bonus_until__gt=now)
            | models.Q(
                publications__status=Publication.Status.ACTIVE,
                publications__expires_at__gt=now,
            )
        )


class ModelProfile(models.Model):
    """Perfil público de una modelo. Nace 'pending' e invisible hasta verificación."""

    objects = ModelProfileQuerySet.as_manager()

    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pendiente"
        VERIFIED = "verified", "Verificado"
        REJECTED = "rejected", "Rechazado"

    class Gender(models.TextChoices):
        FEMALE = "female", "Mujer"
        TRANS = "trans", "Trans"
        MALE = "male", "Hombre"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="model_profile"
    )
    gender = models.CharField(
        "categoría", max_length=10, choices=Gender.choices, default=Gender.FEMALE
    )
    stage_name = models.CharField("nombre artístico", max_length=120)
    slug = models.SlugField(max_length=160, unique=True, blank=True)
    description = models.TextField(blank=True)
    # Foto de perfil (avatar), independiente del muro de fotos (MediaContent).
    # Pasa por el pipeline de privacidad (EXIF/GPS + marca) al subirse.
    avatar = models.ImageField(
        "foto de perfil", upload_to="profiles/avatars/", null=True, blank=True
    )
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
    # "Disponible ahora": cuando contiene una fecha futura, el perfil aparece
    # con badge verde y puede filtrarse con ?available_now=true. Auto-expira
    # solo: cualquier query con now() lo deja afuera al pasar la fecha.
    available_until = models.DateTimeField(null=True, blank=True)
    # Suspensión administrativa. Independiente de la verificación: una modelo
    # puede estar verified + suspended (oculta del público hasta liberar).
    is_suspended = models.BooleanField("suspendido", default=False)
    suspension_reason = models.CharField(max_length=200, blank=True)

    class PhotoAuthenticity(models.TextChoices):
        PENDING = "pending", "Por revisar"
        NONE = "none", "Sin retoque"
        LIGHT = "light", "Retoque leve"
        HEAVY = "heavy", "Con retoque"

    # Nivel de retoque de las fotos, evaluado por el admin (apoyado en el KYC).
    # Vuelve a PENDING cuando la modelo cambia las fotos de su muro.
    photo_authenticity = models.CharField(
        "autenticidad de fotos",
        max_length=10,
        choices=PhotoAuthenticity.choices,
        default=PhotoAuthenticity.PENDING,
    )

    # Referidos: cada modelo tiene un código; al referir a otra que se verifica,
    # ambas reciben días gratis (referral_bonus_until extiende la visibilidad).
    # unique=True ya provee índice; no agregar db_index (duplicaría el índice _like).
    referral_code = models.CharField(max_length=12, unique=True, blank=True)
    referred_by = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="referrals"
    )
    referral_rewarded = models.BooleanField(default=False)
    referral_bonus_until = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.stage_name} ({self.verification_status})"

    @property
    def is_verified(self) -> bool:
        return self.verification_status == self.VerificationStatus.VERIFIED

    @property
    def is_available_now(self) -> bool:
        from django.utils import timezone
        return bool(self.available_until and self.available_until > timezone.now())

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.stage_name) or "perfil"
            slug, n = base, 1
            while ModelProfile.objects.exclude(pk=self.pk).filter(slug=slug).exists():
                n += 1
                slug = f"{base}-{n}"
            self.slug = slug
        if not self.referral_code:
            import uuid
            code = uuid.uuid4().hex[:8]
            while ModelProfile.objects.exclude(pk=self.pk).filter(referral_code=code).exists():
                code = uuid.uuid4().hex[:8]
            self.referral_code = code
        super().save(*args, **kwargs)

    def grant_referral_bonus(self, days=30):
        """Suma días de bono de referido a partir de su vencimiento actual (o ahora)."""
        from django.utils import timezone
        from datetime import timedelta
        base = self.referral_bonus_until if (
            self.referral_bonus_until and self.referral_bonus_until > timezone.now()
        ) else timezone.now()
        self.referral_bonus_until = base + timedelta(days=days)
        self.save(update_fields=["referral_bonus_until"])


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
    max_active_rooms_per_host = models.PositiveIntegerField(
        "tope de habitaciones activas por anfitrión",
        default=10,
        help_text=(
            "Límite global de anuncios de habitación activos simultáneos por "
            "anfitrión (anti-spam). El plan del anfitrión puede cubrir menos, "
            "pero nunca más que este tope."
        ),
    )
    payment_instructions = models.TextField(
        "instrucciones de pago",
        blank=True,
        help_text=(
            "Datos para transferir (banco, tipo de cuenta, número, titular, RUT, "
            "correo). Se le muestran a la modelo al elegir un plan y subir el "
            "comprobante."
        ),
    )
    support_telegram = models.CharField(
        "Telegram de soporte",
        max_length=120,
        blank=True,
        help_text=(
            "Usuario de Telegram del equipo (ej: @PortalVipSoporte) o enlace "
            "t.me/... Se muestra como botón de soporte solo a modelos y "
            "anfitriones. Sin teléfono."
        ),
    )
    referral_bonus_days = models.PositiveIntegerField(
        "días gratis por referido",
        default=30,
        help_text=(
            "Días de visibilidad gratis que reciben AMBAS (la que invita y la "
            "invitada) cuando una referida se verifica."
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


class Favorite(models.Model):
    """Perfil guardado por un usuario (cliente). Un favorito por (user, profile)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites"
    )
    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="favorited_by"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["user", "profile"], name="uniq_favorite"),
        ]

    def __str__(self) -> str:
        return f"{self.user} ♥ {self.profile.stage_name}"


class ProfileReport(models.Model):
    """Reporte de un perfil por contenido inapropiado. Cola de revisión admin."""

    profile = models.ForeignKey(
        ModelProfile, on_delete=models.CASCADE, related_name="reports"
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="profile_reports",
    )
    reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Reporte de {self.profile.stage_name}"
