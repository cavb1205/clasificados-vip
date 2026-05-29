from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.profiles.models import ModelProfile
from core.permissions import IsModel
from .models import PaymentReceipt, Publication, SubscriptionPlan
from .serializers import (
    PaymentReceiptSerializer,
    PublicationSerializer,
    PublicPublicationSerializer,
    SubscriptionPlanSerializer,
)


class PlanListView(generics.ListAPIView):
    """Planes de publicación disponibles (configurados por el admin)."""

    serializer_class = SubscriptionPlanSerializer
    permission_classes = [permissions.AllowAny]
    queryset = SubscriptionPlan.objects.filter(is_active=True)


class MyPublicationViewSet(viewsets.ModelViewSet):
    """La modelo gestiona sus anuncios y sube comprobantes de pago."""

    serializer_class = PublicationSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]

    def _get_profile(self):
        profile = ModelProfile.objects.filter(user=self.request.user).first()
        if profile is None:
            raise PermissionDenied("Primero debes crear tu perfil.")
        return profile

    def get_queryset(self):
        return Publication.objects.filter(profile__user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(profile=self._get_profile())

    @action(detail=True, methods=["post"], serializer_class=PaymentReceiptSerializer)
    def receipt(self, request, pk=None):
        """Sube el comprobante de transferencia → publicación pasa a pending_payment."""
        publication = self.get_object()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(publication=publication)
        publication.status = Publication.Status.PENDING_PAYMENT
        publication.save(update_fields=["status", "updated_at"])
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], serializer_class=PublicationSerializer)
    def renew(self, request, pk=None):
        """Clona una publicación expirada en una nueva en draft (mismo título y plan).

        Mantiene la publicación original para preservar historial (auditoría, futuras
        estadísticas) y deja la nueva lista para subir comprobante de pago.
        """
        source = self.get_object()
        if source.status != Publication.Status.EXPIRED:
            return Response(
                {"detail": "Solo se pueden renovar publicaciones expiradas."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        renewed = Publication.objects.create(
            profile=source.profile,
            plan=source.plan,
            title=source.title,
            status=Publication.Status.DRAFT,
        )
        return Response(PublicationSerializer(renewed).data, status=status.HTTP_201_CREATED)


class PublicPublicationListView(generics.ListAPIView):
    """Anuncios vigentes (activos y no expirados), destacados primero."""

    serializer_class = PublicPublicationSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            Publication.objects.filter(
                status=Publication.Status.ACTIVE,
                expires_at__gt=timezone.now(),
                profile__verification_status=ModelProfile.VerificationStatus.VERIFIED,
                profile__is_suspended=False,
            )
            .select_related("profile", "profile__city", "profile__city__region")
        )
        region = self.kwargs.get("region") or self.request.query_params.get("region")
        city = self.kwargs.get("city") or self.request.query_params.get("city")
        if region:
            qs = qs.filter(profile__city__region__slug=region)
        if city:
            qs = qs.filter(profile__city__slug=city)
        return qs


# ─── Endpoints admin para el panel /admin del frontend ──────────────────────
from rest_framework import serializers as drf_serializers  # noqa: E402

from apps.profiles.models import ModelProfile  # ya importado arriba; redundante seguro
from apps.reviews.models import Review  # noqa: E402
from apps.stories.models import StoryReport  # noqa: E402
from apps.verification.models import VerificationRequest  # noqa: E402


class AdminPaymentReceiptSerializer(drf_serializers.ModelSerializer):
    """Detalle de pago para revisión en /admin/pagos/."""

    publication_title = drf_serializers.CharField(source="publication.title", read_only=True)
    publication_id = drf_serializers.IntegerField(source="publication.id", read_only=True)
    plan_name = drf_serializers.CharField(
        source="publication.plan.name", read_only=True, default=""
    )
    plan_price = drf_serializers.IntegerField(
        source="publication.plan.price", read_only=True, default=None
    )
    stage_name = drf_serializers.CharField(
        source="publication.profile.stage_name", read_only=True
    )
    profile_slug = drf_serializers.CharField(
        source="publication.profile.slug", read_only=True
    )
    image_url = drf_serializers.SerializerMethodField()

    class Meta:
        model = PaymentReceipt
        fields = [
            "id", "publication_id", "publication_title", "plan_name", "plan_price",
            "stage_name", "profile_slug", "amount", "status", "note",
            "image_url", "created_at", "reviewed_at",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class AdminPaymentQueueView(generics.ListAPIView):
    """Cola de pagos pendientes (o filtrado por ?status=)."""

    serializer_class = AdminPaymentReceiptSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = PaymentReceipt.objects.select_related(
            "publication", "publication__plan", "publication__profile"
        )
        s = self.request.query_params.get("status", "pending")
        if s in {"pending", "approved", "rejected"}:
            qs = qs.filter(status=s)
        return qs


class AdminPaymentActionView(generics.GenericAPIView):
    """POST /admin/payments/<id>/action/ con {action: 'approve'|'reject', note?}."""

    permission_classes = [permissions.IsAdminUser]
    queryset = PaymentReceipt.objects.all()

    def post(self, request, pk):
        receipt = self.get_object()
        action_kind = (request.data.get("action") or "").lower()
        note = request.data.get("note") or ""
        if action_kind == "approve":
            receipt.approve(reviewer=request.user)
        elif action_kind == "reject":
            receipt.reject(reviewer=request.user, note=note)
        else:
            return Response({"detail": "action debe ser approve|reject"}, status=400)
        return Response(
            AdminPaymentReceiptSerializer(receipt, context={"request": request}).data
        )


class AdminStatsView(generics.GenericAPIView):
    """KPIs agregados para el dashboard del admin."""

    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        now = timezone.now()
        soon = now + timezone.timedelta(days=3)
        active_pubs = Publication.objects.filter(
            status=Publication.Status.ACTIVE, expires_at__gt=now
        )
        first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        revenue_qs = PaymentReceipt.objects.filter(
            status=PaymentReceipt.Status.APPROVED,
            reviewed_at__gte=first_of_month,
        )
        revenue_month = sum(
            (r.amount or (r.publication.plan.price if r.publication.plan_id else 0))
            for r in revenue_qs.select_related("publication__plan")
        )
        return Response({
            "pending_kyc": VerificationRequest.objects.filter(
                status=VerificationRequest.Status.PENDING
            ).count(),
            "pending_payments": PaymentReceipt.objects.filter(
                status=PaymentReceipt.Status.PENDING
            ).count(),
            "pending_reviews": Review.objects.filter(status="pending").count(),
            "open_reports": StoryReport.objects.count(),
            "verified_models": ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            ).count(),
            "active_publications": active_pubs.count(),
            "expiring_soon": active_pubs.filter(expires_at__lte=soon).count(),
            "revenue_month_clp": revenue_month,
        })


class AdminExpirePublicationView(generics.GenericAPIView):
    """POST /admin/publications/<id>/expire/ → marca como EXPIRED y la oculta."""

    permission_classes = [permissions.IsAdminUser]
    queryset = Publication.objects.all()

    def post(self, request, pk):
        pub = self.get_object()
        pub.status = Publication.Status.EXPIRED
        pub.expires_at = timezone.now()
        pub.save(update_fields=["status", "expires_at"])
        return Response({"detail": "Publicación expirada."})
