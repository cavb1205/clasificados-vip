from rest_framework import serializers

from apps.profiles.models import ModelProfile
from .models import VerificationChallenge, VerificationRequest


class VerificationRequestSerializer(serializers.ModelSerializer):
    """La modelo sube cédula + selfie + video de consentimiento.

    Los 3 archivos se almacenan cifrados con Fernet en el storage privado.
    El `challenge_code` debe coincidir con uno emitido recientemente para
    el usuario (probando que el video se grabó hoy con ese código a la vista).
    """

    id_document = serializers.FileField(write_only=True)
    selfie = serializers.FileField(write_only=True)
    consent_video = serializers.FileField(write_only=True)
    challenge_code = serializers.CharField(write_only=True, max_length=10)

    class Meta:
        model = VerificationRequest
        fields = [
            "id", "id_document", "selfie", "consent_video", "challenge_code",
            "status", "created_at",
        ]
        read_only_fields = ["status", "created_at"]

    def validate_challenge_code(self, value):
        user = self.context["request"].user
        try:
            self._challenge = VerificationChallenge.objects.get(user=user, code=value)
        except VerificationChallenge.DoesNotExist:
            raise serializers.ValidationError("Código de desafío inválido.")
        if not self._challenge.is_valid():
            raise serializers.ValidationError("Código de desafío expirado o ya usado.")
        return value

    def validate_consent_video(self, value):
        if not value.content_type or not value.content_type.startswith("video/"):
            raise serializers.ValidationError("El consentimiento debe ser un video.")
        return value

    def create(self, validated_data):
        id_doc = validated_data.pop("id_document")
        selfie = validated_data.pop("selfie")
        video = validated_data.pop("consent_video")
        code = validated_data.pop("challenge_code")

        request_obj = VerificationRequest(
            user=self.context["request"].user,
            challenge_code=code,
        )
        request_obj.store_encrypted("id_document", id_doc.read())
        request_obj.store_encrypted("selfie", selfie.read())
        request_obj.store_encrypted("consent_video", video.read(), ext="enc")
        request_obj.save()
        self._challenge.consume()
        return request_obj


class AdminQueueSerializer(serializers.ModelSerializer):
    """Vista compacta de una VR pendiente para la cola de moderación."""

    user_email = serializers.EmailField(source="user.email", read_only=True)
    user_username = serializers.CharField(source="user.username", read_only=True)
    stage_name = serializers.SerializerMethodField()
    has_id_document = serializers.SerializerMethodField()
    has_selfie = serializers.SerializerMethodField()
    has_consent_video = serializers.SerializerMethodField()

    class Meta:
        model = VerificationRequest
        fields = [
            "id", "user_email", "user_username", "stage_name", "challenge_code",
            "has_id_document", "has_selfie", "has_consent_video",
            "status", "created_at",
        ]

    def get_stage_name(self, obj):
        profile = ModelProfile.objects.filter(user=obj.user).first()
        return profile.stage_name if profile else None

    def get_has_id_document(self, obj) -> bool:
        return bool(obj.id_document)

    def get_has_selfie(self, obj) -> bool:
        return bool(obj.selfie)

    def get_has_consent_video(self, obj) -> bool:
        return bool(obj.consent_video)
