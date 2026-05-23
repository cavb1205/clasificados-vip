from rest_framework import serializers

from .models import VerificationRequest


class VerificationRequestSerializer(serializers.ModelSerializer):
    """La modelo sube cédula + selfie; se almacenan cifradas (no se devuelven URLs)."""

    id_document = serializers.FileField(write_only=True)
    selfie = serializers.FileField(write_only=True)

    class Meta:
        model = VerificationRequest
        fields = ["id", "id_document", "selfie", "status", "created_at"]
        read_only_fields = ["status", "created_at"]

    def create(self, validated_data):
        id_doc = validated_data.pop("id_document")
        selfie = validated_data.pop("selfie")
        request_obj = VerificationRequest(user=self.context["request"].user)
        request_obj.store_encrypted("id_document", id_doc.read())
        request_obj.store_encrypted("selfie", selfie.read())
        request_obj.save()
        return request_obj
