from django.urls import reverse
from rest_framework import serializers

from apps.profiles.models import City
from apps.publications.models import SubscriptionPlan

from .models import HostProfile, RoomListing, RoomPhoto, RoomReceipt


class RoomPlanSerializer(serializers.ModelSerializer):
    """Planes de habitación disponibles (kind=room_listing)."""

    class Meta:
        model = SubscriptionPlan
        fields = ["id", "name", "slug", "duration_days", "price"]


class HostProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostProfile
        fields = ["id", "display_name", "phone", "whatsapp", "created_at"]
        read_only_fields = ["created_at"]


class RoomPhotoSerializer(serializers.ModelSerializer):
    """Foto de habitación. La URL apunta a la vista gateada, no a MEDIA_URL."""

    upload = serializers.ImageField(write_only=True)
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = RoomPhoto
        fields = ["id", "upload", "image_url", "order", "created_at"]
        read_only_fields = ["image_url", "created_at"]

    def get_image_url(self, obj):
        request = self.context.get("request")
        path = reverse("api:rooms:room-photo-file", args=[obj.pk])
        return request.build_absolute_uri(path) if request else path


class RoomListingSerializer(serializers.ModelSerializer):
    """Gestión por el anfitrión. Estado y expiración los controla el backend."""

    plan = RoomPlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(
            is_active=True, kind=SubscriptionPlan.Kind.ROOM_LISTING
        ),
        source="plan",
        write_only=True,
        required=False,
        allow_null=True,
    )
    city_id = serializers.PrimaryKeyRelatedField(
        queryset=City.objects.all(), source="city", write_only=True
    )
    city = serializers.CharField(source="city.name", read_only=True, default=None)
    region = serializers.CharField(source="city.region.name", read_only=True, default=None)
    photos = RoomPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = RoomListing
        fields = [
            "id", "title", "description", "city", "region", "city_id", "sector",
            "price", "price_period", "whatsapp", "phone",
            "plan", "plan_id", "status", "is_paused", "expires_at",
            "photos", "created_at", "updated_at",
        ]
        read_only_fields = ["status", "is_paused", "expires_at", "created_at", "updated_at"]


class RoomReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomReceipt
        fields = ["id", "image", "amount", "status", "created_at"]
        read_only_fields = ["status", "created_at"]


class PublicRoomListingSerializer(serializers.ModelSerializer):
    """Vista para las modelos activas: muestra ciudad y contacto, nunca dirección."""

    city = serializers.CharField(source="city.name", read_only=True, default=None)
    region = serializers.CharField(source="city.region.name", read_only=True, default=None)
    photos = RoomPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = RoomListing
        fields = [
            "id", "title", "description", "city", "region", "sector",
            "price", "price_period", "whatsapp", "phone", "photos", "created_at",
        ]
