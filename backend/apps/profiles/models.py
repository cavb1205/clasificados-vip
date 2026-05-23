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
    """Catálogo de servicios para filtrado y SEO."""

    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


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
    city = models.ForeignKey(
        City, on_delete=models.SET_NULL, null=True, related_name="profiles"
    )
    verification_status = models.CharField(
        max_length=10,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
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
