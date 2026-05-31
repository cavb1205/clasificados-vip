from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    """Registro de modelo, cliente o anfitrión (el rol 'admin' no se autoasigna)."""

    password = serializers.CharField(write_only=True, validators=[validate_password])
    role = serializers.ChoiceField(
        choices=[User.Role.MODEL, User.Role.CLIENT, User.Role.HOST],
        default=User.Role.CLIENT,
    )

    class Meta:
        model = User
        fields = ["id", "email", "username", "password", "role"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "role", "email_verified", "is_staff"]
        read_only_fields = fields
