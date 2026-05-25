from django.db.models import Avg, Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import generics, permissions, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination

from apps.publications.models import Publication
from apps.reviews.models import Review
from core.permissions import IsModel
from .models import City, ModelProfile, Region, Service
from .serializers import (
    CitySerializer,
    ModelProfileSerializer,
    PublicProfileSerializer,
    RegionSerializer,
    ServiceSerializer,
)


class PublicProfilePagination(PageNumberPagination):
    page_size = 12
    page_size_query_param = "page_size"
    max_page_size = 48


def annotate_public_profiles(qs):
    """Anota rating agregado y flag de destacada (publicación activa con is_featured).

    Reutilizado por el listado y el detalle público para que el cliente reciba
    los mismos campos sin repetir lógica.
    """
    featured_pub = Publication.objects.filter(
        profile=OuterRef("pk"),
        status=Publication.Status.ACTIVE,
        is_featured=True,
        expires_at__gt=timezone.now(),
    )
    return qs.annotate(
        is_featured=Exists(featured_pub),
        rating_average=Avg("reviews__rating", filter=Q(reviews__status=Review.Status.APPROVED)),
        rating_count=Count("reviews", filter=Q(reviews__status=Review.Status.APPROVED)),
    )


class RegionListView(generics.ListAPIView):
    queryset = Region.objects.all()
    serializer_class = RegionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class ServiceListView(generics.ListAPIView):
    queryset = Service.objects.all()
    serializer_class = ServiceSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


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
    """Listado público por región/comuna, con filtros y paginación.

    Filtros (query params, todos opcionales):
      service=<slug>          servicio M2M (puede repetirse)
      min_age, max_age        rango de edad
      min_rate, max_rate      rango de tarifa base (CLP)
    """

    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = PublicProfilePagination

    def get_queryset(self):
        params = self.request.query_params
        qs = annotate_public_profiles(
            ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            )
            .select_related("city", "city__region")
            .prefetch_related("services", "media")
        )

        region = self.kwargs.get("region") or params.get("region")
        city = self.kwargs.get("city") or params.get("city")
        if region:
            qs = qs.filter(city__region__slug=region)
        if city:
            qs = qs.filter(city__slug=city)

        # Búsqueda libre.
        q = (params.get("q") or "").strip()
        if q:
            qs = qs.filter(Q(stage_name__icontains=q) | Q(description__icontains=q))

        # Filtros adicionales.
        services = params.getlist("service")
        if services:
            qs = qs.filter(services__slug__in=services).distinct()

        for key, lookup in (("min_age", "age__gte"), ("max_age", "age__lte"),
                            ("min_rate", "base_rate__gte"), ("max_rate", "base_rate__lte")):
            value = params.get(key)
            if value and value.isdigit():
                qs = qs.filter(**{lookup: int(value)})

        # Destacadas primero (mejor rating dentro de cada grupo, luego más reciente).
        return qs.order_by("-is_featured", "-rating_average", "-created_at")


class PublicProfileDetailView(generics.RetrieveAPIView):
    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = "slug"

    def get_queryset(self):
        return annotate_public_profiles(
            ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            ).select_related("city", "city__region").prefetch_related("services", "media")
        )
