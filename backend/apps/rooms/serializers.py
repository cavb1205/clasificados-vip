from django.urls import reverse
from rest_framework import serializers

from apps.profiles.models import City
from apps.publications.models import SubscriptionPlan

from .models import HostProfile, RoomListing, RoomPhoto, RoomReceipt


class RoomPlanSerializer(serializers.ModelSerializer):
    """Planes de habitación disponibles (kind=room_listing)."""

    class Meta:
        model = SubscriptionPlan
        fields = ["id", "name", "slug", "duration_days", "price", "max_listings", "includes_featured"]


class HostProfileSerializer(serializers.ModelSerializer):
    plan_name = serializers.CharField(source="active_plan.name", read_only=True, default=None)
    subscription_active = serializers.BooleanField(read_only=True)
    used_slots = serializers.SerializerMethodField()
    available_slots = serializers.SerializerMethodField()

    class Meta:
        model = HostProfile
        fields = [
            "id", "display_name", "phone", "whatsapp", "created_at",
            "plan_name", "plan_slots", "plan_featured", "plan_expires_at",
            "subscription_active", "used_slots", "available_slots",
        ]
        read_only_fields = [
            "created_at", "plan_name", "plan_slots", "plan_featured",
            "plan_expires_at", "subscription_active", "used_slots", "available_slots",
        ]

    def get_used_slots(self, obj):
        return obj.used_slots()

    def get_available_slots(self, obj):
        return obj.available_slots()


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
    """Gestión por el anfitrión. El estado y la vigencia los controla el backend."""

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
            "status", "is_featured", "is_paused", "expires_at",
            "available_until", "is_available_now",
            "photos", "created_at", "updated_at",
        ]
        read_only_fields = [
            "status", "is_featured", "is_paused", "expires_at",
            "available_until", "is_available_now", "created_at", "updated_at",
        ]


class RoomReceiptSerializer(serializers.ModelSerializer):
    """El anfitrión sube un comprobante para contratar/renovar un plan."""

    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(
            is_active=True, kind=SubscriptionPlan.Kind.ROOM_LISTING
        ),
        source="plan",
        write_only=True,
    )

    class Meta:
        model = RoomReceipt
        fields = ["id", "plan_id", "image", "amount", "status", "created_at"]
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
            "price", "price_period", "whatsapp", "phone",
            "is_featured", "is_available_now", "photos", "created_at",
        ]
