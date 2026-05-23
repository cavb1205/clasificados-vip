from rest_framework import serializers

from .models import City, ModelProfile, Region, Service


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
        fields = ["id", "name", "slug"]


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

    class Meta:
        model = ModelProfile
        fields = [
            "id", "stage_name", "slug", "description", "age",
            "services", "service_ids", "base_rate",
            "city", "city_id", "verification_status",
            "created_at", "updated_at",
        ]
        read_only_fields = ["slug", "verification_status", "created_at", "updated_at"]

    def validate_age(self, value):
        if value < 18:
            raise serializers.ValidationError("La edad debe ser 18 o más.")
        return value


class PublicProfileSerializer(serializers.ModelSerializer):
    """Vista pública (solo perfiles verificados). No expone datos del usuario."""

    city = CitySerializer(read_only=True)
    services = ServiceSerializer(many=True, read_only=True)
    photos = serializers.SerializerMethodField()
    cover_photo = serializers.SerializerMethodField()

    class Meta:
        model = ModelProfile
        fields = [
            "stage_name", "slug", "description", "age", "services",
            "base_rate", "city", "photos", "cover_photo",
        ]

    def _abs(self, url: str) -> str:
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def _photo_qs(self, obj):
        return obj.media.filter(media_type="photo")

    def get_photos(self, obj):
        return [self._abs(m.file.url) for m in self._photo_qs(obj)]

    def get_cover_photo(self, obj):
        first = self._photo_qs(obj).first()
        return self._abs(first.file.url) if first else None
