from rest_framework import serializers

from apps.profiles.models import ModelProfile
from .models import Review


class ReviewSerializer(serializers.ModelSerializer):
    """Creación de reseña por un cliente. Nace 'pending' hasta moderación."""

    profile_slug = serializers.SlugField(write_only=True)
    client_username = serializers.CharField(source="client.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "profile_slug", "client_username", "rating", "comment",
            "status", "created_at",
        ]
        read_only_fields = ["status", "created_at"]

    def validate_profile_slug(self, value):
        profile = ModelProfile.objects.filter(
            slug=value, verification_status=ModelProfile.VerificationStatus.VERIFIED
        ).first()
        if profile is None:
            raise serializers.ValidationError("Perfil no encontrado o no verificado.")
        self._profile = profile
        return value

    def validate(self, attrs):
        client = self.context["request"].user
        if not client.email_verified:
            raise serializers.ValidationError(
                "Debes verificar tu correo antes de dejar una reseña."
            )
        if Review.objects.filter(profile=self._profile, client=client).exists():
            raise serializers.ValidationError("Ya dejaste una reseña en este perfil.")
        return attrs

    def create(self, validated_data):
        validated_data.pop("profile_slug", None)
        return Review.objects.create(
            profile=self._profile, client=self.context["request"].user, **validated_data
        )


class PublicReviewSerializer(serializers.ModelSerializer):
    client_username = serializers.CharField(source="client.username", read_only=True)

    class Meta:
        model = Review
        fields = ["id", "client_username", "rating", "comment", "created_at"]
