import re
from datetime import timedelta

from rest_framework import serializers

from .models import City, ModelProfile, Region, Service, SiteConfig


def _normalize_whatsapp(raw: str) -> str:
    """Limpia el WhatsApp dejando solo dígitos (formato wa.me)."""
    return re.sub(r"\D", "", raw or "")


def _normalize_telegram(raw: str) -> str:
    """Normaliza Telegram a 'usuario' (sin @ ni dominio)."""
    if not raw:
        return ""
    s = raw.strip()
    s = re.sub(r"^https?://(www\.)?t\.me/", "", s, flags=re.I)
    return s.lstrip("@")


class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = ["id", "name", "slug", "order"]


class CitySerializer(serializers.ModelSerializer):
    region = RegionSerializer(read_only=True)

    class Meta:
        model = City
        fields = ["id", "name", "slug", "region"]


class ServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["id", "name", "slug", "category"]


class ModelProfileSerializer(serializers.ModelSerializer):
    """Serializer de escritura/lectura para la dueña del perfil."""

    city = CitySerializer(read_only=True)
    city_id = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), source="city", write_only=True, required=False
    )
    services = ServiceSerializer(many=True, read_only=True)
    service_ids = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.all(),
        source="services",
        many=True,
        write_only=True,
        required=False,
    )

    trial_ends_at = serializers.SerializerMethodField()
    pending_verification = serializers.SerializerMethodField()
    latest_verification = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = ModelProfile
        fields = [
            "id", "stage_name", "slug", "gender", "description", "age",
            "services", "service_ids", "base_rate", "avatar",
            "city", "city_id",
            "whatsapp", "telegram",
            "verification_status", "verified_at", "trial_ends_at",
            "pending_verification", "latest_verification",
            "available_until",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "slug", "verification_status", "verified_at", "trial_ends_at",
            "pending_verification", "latest_verification",
            "available_until",
            "created_at", "updated_at",
        ]

    def get_pending_verification(self, obj) -> bool:
        """True si el usuario subió KYC y está esperando revisión del admin."""
        from apps.verification.models import VerificationRequest
        return VerificationRequest.objects.filter(
            user=obj.user, status=VerificationRequest.Status.PENDING
        ).exists()

    def get_latest_verification(self, obj):
        """Resumen de la última verificación enviada (no expone los archivos)."""
        from apps.verification.models import VerificationRequest
        vr = (
            VerificationRequest.objects.filter(user=obj.user)
            .order_by("-created_at")
            .first()
        )
        if vr is None:
            return None
        return {
            "id": vr.id,
            "status": vr.status,
            "has_id_document": bool(vr.id_document),
            "has_selfie": bool(vr.selfie),
            "has_consent_video": bool(vr.consent_video),
            "created_at": vr.created_at,
            "reviewed_at": vr.reviewed_at,
            "rejection_reason": vr.rejection_reason,
        }

    def get_avatar(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        url = obj.avatar.url
        return request.build_absolute_uri(url) if request else url

    def get_trial_ends_at(self, obj):
        if not obj.verified_at:
            return None
        return obj.verified_at + timedelta(days=SiteConfig.get().trial_days)

    def validate_age(self, value):
        if value < 18:
            raise serializers.ValidationError("La edad debe ser 18 o más.")
        return value

    def validate_whatsapp(self, value):
        digits = _normalize_whatsapp(value)
        if digits and not (8 <= len(digits) <= 15):
            raise serializers.ValidationError(
                "WhatsApp inválido: deben ser entre 8 y 15 dígitos."
            )
        return digits

    def validate_telegram(self, value):
        normalized = _normalize_telegram(value)
        if normalized and not re.match(r"^[A-Za-z0-9_]{3,40}$", normalized):
            raise serializers.ValidationError(
                "Telegram inválido: solo letras, números o guión bajo (3-40)."
            )
        return normalized


class PublicProfileSerializer(serializers.ModelSerializer):
    """Vista pública (solo perfiles verificados). No expone datos del usuario."""

    city = CitySerializer(read_only=True)
    services = ServiceSerializer(many=True, read_only=True)
    avatar = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()
    cover_photo = serializers.SerializerMethodField()
    # Anotados por la vista (annotate_public_profiles); ausentes en otros contextos.
    is_featured = serializers.BooleanField(read_only=True, default=False)
    rating_average = serializers.FloatField(read_only=True, allow_null=True)
    rating_count = serializers.IntegerField(read_only=True, default=0)

    is_available_now = serializers.BooleanField(read_only=True)
    available_until = serializers.DateTimeField(read_only=True)

    class Meta:
        model = ModelProfile
        fields = [
            "stage_name", "slug", "gender", "description", "age", "services",
            "base_rate", "city", "avatar", "photos", "videos", "cover_photo",
            "is_featured", "rating_average", "rating_count",
            "whatsapp", "telegram",
            "is_available_now", "available_until",
        ]

    def _abs(self, url: str) -> str:
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def _photo_qs(self, obj):
        return obj.media.filter(media_type="photo", is_hidden=False)

    def get_avatar(self, obj):
        return self._abs(obj.avatar.url) if obj.avatar else None

    def get_photos(self, obj):
        # Se muestran solo hasta el cupo del plan (las primeras según su orden).
        # Las extra no se borran: reaparecen si vuelve a un plan con más cupo.
        max_photos, _ = self._media_limits(obj)
        return [self._abs(m.file.url) for m in self._photo_qs(obj)[:max_photos]]

    def get_videos(self, obj):
        # Videos del muro no ocultos por moderación, hasta el cupo del plan.
        _, max_videos = self._media_limits(obj)
        videos = obj.media.filter(media_type="video", is_hidden=False)[:max_videos]
        return [self._abs(m.file.url) for m in videos]

    @staticmethod
    def _media_limits(obj):
        from apps.media_content.models import profile_media_limits
        return profile_media_limits(obj)

    def get_cover_photo(self, obj):
        # La portada (tarjetas, og:image) prioriza el avatar; si no hay, la 1ª del muro.
        if obj.avatar:
            return self._abs(obj.avatar.url)
        first = self._photo_qs(obj).first()
        return self._abs(first.file.url) if first else None
