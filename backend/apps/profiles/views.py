from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError

from core.permissions import IsModel
from .models import City, ModelProfile, Region
from .serializers import (
    CitySerializer,
    ModelProfileSerializer,
    PublicProfileSerializer,
    RegionSerializer,
)


class RegionListView(generics.ListAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    permission_classes = [permissions.AllowAny]


class CityListView(generics.ListAPIView):
    serializer_class = CitySerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = City.objects.select_related("region")
        region_slug = self.request.query_params.get("region")
        if region_slug:
            qs = qs.filter(region__slug=region_slug)
        return qs


class MyProfileViewSet(viewsets.ModelViewSet):
    """La modelo gestiona su único perfil (incl. actualizar ciudad en tiempo real)."""

    serializer_class = ModelProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]

    def get_queryset(self):
        return ModelProfile.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        if ModelProfile.objects.filter(user=self.request.user).exists():
            raise ValidationError("Ya tienes un perfil. Edítalo en lugar de crear otro.")
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        if serializer.instance.user != self.request.user:
            raise PermissionDenied()
        serializer.save()


class PublicProfileListView(generics.ListAPIView):
    """Listado público por región/comuna: solo perfiles verificados."""

    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        qs = (
            ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            )
            .select_related("city", "city__region")
            .prefetch_related("services", "media")
        )
        region = self.kwargs.get("region") or self.request.query_params.get("region")
        city = self.kwargs.get("city") or self.request.query_params.get("city")
        if region:
            qs = qs.filter(city__region__slug=region)
        if city:
            qs = qs.filter(city__slug=city)
        return qs


class PublicProfileDetailView(generics.RetrieveAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return ModelProfile.objects.filter(
            verification_status=ModelProfile.VerificationStatus.VERIFIED
        ).select_related("city", "city__region").prefetch_related("services", "media")
