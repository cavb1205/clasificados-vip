from rest_framework import serializers
from core.payment_receipts import clean_receipt_image

from .models import PaymentReceipt, Publication, SubscriptionPlan


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubscriptionPlan
        fields = ["id", "name", "slug", "duration_days", "price", "includes_featured"]


class PublicationSerializer(serializers.ModelSerializer):
    """Gestión por la dueña. El estado y la expiración los controla el backend."""

    plan = SubscriptionPlanSerializer(read_only=True)
    plan_id = serializers.PrimaryKeyRelatedField(
        queryset=SubscriptionPlan.objects.filter(
            is_active=True, kind=SubscriptionPlan.Kind.MODEL_PUBLICATION
        ),
        source="plan",
        write_only=True,
        required=False,
        allow_null=True,
    )
    # El título es interno (no se muestra públicamente); se autogenera si no viene.
    title = serializers.CharField(required=False, allow_blank=True, max_length=160)

    class Meta:
        model = Publication
        fields = [
            "id", "title", "is_featured", "status", "expires_at",
            "plan", "plan_id", "created_at", "updated_at",
        ]
        read_only_fields = ["is_featured", "status", "expires_at", "created_at", "updated_at"]

    def validate(self, attrs):
        if self.instance and "plan" in attrs and attrs["plan"] != self.instance.plan:
            if self.instance.is_live or self.instance.receipts.filter(status="pending").exists():
                raise serializers.ValidationError({
                    "plan_id": "No puedes cambiar el plan de un anuncio activo o con un pago pendiente. Crea otro anuncio para contratar otro plan."
                })
        return attrs


class PaymentReceiptSerializer(serializers.ModelSerializer):
    def validate_image(self, upload):
        return clean_receipt_image(upload)

    class Meta:
        model = PaymentReceipt
        fields = ["id", "image", "amount", "status", "created_at"]
        read_only_fields = ["status", "created_at"]


class PublicPublicationSerializer(serializers.ModelSerializer):
    """Vista pública de anuncios vigentes."""

    stage_name = serializers.CharField(source="profile.stage_name", read_only=True)
    slug = serializers.CharField(source="profile.slug", read_only=True)
    city = serializers.CharField(source="profile.city.name", read_only=True, default=None)

    class Meta:
        model = Publication
        fields = ["id", "title", "is_featured", "stage_name", "slug", "city"]
