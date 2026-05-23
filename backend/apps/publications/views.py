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
