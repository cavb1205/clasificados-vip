from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.conf import settings
from django.db import transaction
from rest_framework import serializers

from .models import LegalAcceptance, PrivacyRequest

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Registro de modelo, cliente o anfitrión (el rol 'admin' no se autoasigna)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    terms_accepted = serializers.BooleanField(write_only=True, required=True)
    privacy_accepted = serializers.BooleanField(write_only=True, required=True)
    role = serializers.ChoiceField(
        choices=[User.Role.MODEL, User.Role.CLIENT, User.Role.HOST],
        default=User.Role.CLIENT,
    )

    class Meta:
        model = User
        fields = [
            "id", "email", "username", "password", "role",
            "terms_accepted", "privacy_accepted",
        ]

    def validate_terms_accepted(self, value):
        if not value:
            raise serializers.ValidationError("Debes aceptar los Términos y condiciones.")
        return value

    def validate_privacy_accepted(self, value):
        if not value:
            raise serializers.ValidationError("Debes confirmar que leíste la Política de privacidad.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("terms_accepted")
        validated_data.pop("privacy_accepted")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        LegalAcceptance.objects.create(
            user=user,
            role=user.role,
            terms_version=settings.LEGAL_TERMS_VERSION,
            privacy_version=settings.LEGAL_PRIVACY_VERSION,
            source=LegalAcceptance.Source.REGISTRATION,
        )
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "email_verified", "is_staff"]
        read_only_fields = fields


class ChangePasswordSerializer(serializers.Serializer):
    """Cambio de contraseña estando logueado (requiere la actual)."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("La contraseña actual es incorrecta.")
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.session_version += 1
        user.save(update_fields=["password", "session_version"])
        return user


class PrivacyRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacyRequest
        fields = [
            "id", "request_type", "details", "resolution_notes", "status",
            "created_at", "updated_at",
        ]
        read_only_fields = [
            "id", "resolution_notes", "status", "created_at", "updated_at",
        ]

    def validate_details(self, value):
        if len(value) > 3000:
            raise serializers.ValidationError("El detalle no puede superar 3.000 caracteres.")
        return value.strip()
