from datetime import timedelta

from django.db.models import Avg, Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.publications.models import Publication
from apps.reviews.models import Review
from core.permissions import IsModel
from .models import City, ModelProfile, ProfileEvent, Region, Service, SiteConfig
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


def _visible_profile_subquery(city_field_outer):
    """Subquery Exists() de perfiles visibles para anclar a city/region.

    Usa la misma regla de visibilidad pública: verified + (en trial o con
    publicación activa no expirada).
    """
    from apps.publications.models import Publication
    now = timezone.now()
    trial_cutoff = now - timedelta(days=SiteConfig.get().trial_days)
    return Exists(
        ModelProfile.objects.filter(
            city_field_outer,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        ).filter(
            Q(verified_at__gte=trial_cutoff)
            | Q(
                publications__status=Publication.Status.ACTIVE,
                publications__expires_at__gt=now,
            )
        )
    )


class RegionListView(generics.ListAPIView):
    serializer_class = RegionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Region.objects.all()
        # ?has_profiles=true → solo regiones que tienen al menos una comuna
        # con perfiles visibles.
        if self.request.query_params.get("has_profiles") == "true":
            qs = qs.annotate(
                _has=_visible_profile_subquery(Q(city__region=OuterRef("pk")))
            ).filter(_has=True)
        return qs


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
        # ?has_profiles=true → solo comunas con al menos un perfil visible.
        if self.request.query_params.get("has_profiles") == "true":
            qs = qs.annotate(
                _has=_visible_profile_subquery(Q(city=OuterRef("pk")))
            ).filter(_has=True)
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
        now = timezone.now()
        trial_cutoff = now - timedelta(days=SiteConfig.get().trial_days)
        # Visibilidad: verificada Y (en trial gratuito O con publicación activa).
        qs = annotate_public_profiles(
            ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            )
            .filter(
                Q(verified_at__gte=trial_cutoff)
                | Q(
                    publications__status=Publication.Status.ACTIVE,
                    publications__expires_at__gt=now,
                )
            )
            .distinct()
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

        # Filtros adicionales por etiquetas (servicios, extras, características).
        # Acepta tanto el alias histórico `service=` como el nuevo `tag=`.
        tags = params.getlist("tag") + params.getlist("service")
        if tags:
            # Si llegan varias etiquetas, requerir TODAS (AND).
            for slug in set(tags):
                qs = qs.filter(services__slug=slug)
            qs = qs.distinct()

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
        now = timezone.now()
        trial_cutoff = now - timedelta(days=SiteConfig.get().trial_days)
        return annotate_public_profiles(
            ModelProfile.objects.filter(
                verification_status=ModelProfile.VerificationStatus.VERIFIED
            )
            .filter(
                Q(verified_at__gte=trial_cutoff)
                | Q(
                    publications__status=Publication.Status.ACTIVE,
                    publications__expires_at__gt=now,
                )
            )
            .distinct()
            .select_related("city", "city__region")
            .prefetch_related("services", "media")
        )


class LogProfileEventView(APIView):
    """POST público anónimo: registra una visita o click de contacto.

    El throttle global de anónimos (60/min) limita el spam. Para protección más
    fuerte, en producción habría que sumar BotID/captcha + dedup por sesión
    desde el lado servidor; por ahora la dedup se hace en el cliente vía
    sessionStorage (`viewed_<slug>`).
    """

    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        kind = request.data.get("kind")
        if kind not in (ProfileEvent.Kind.VIEW, ProfileEvent.Kind.CONTACT):
            return Response({"detail": "kind inválido."}, status=status.HTTP_400_BAD_REQUEST)
        profile = ModelProfile.objects.filter(
            slug=slug, verification_status=ModelProfile.VerificationStatus.VERIFIED
        ).first()
        if not profile:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ProfileEvent.objects.create(profile=profile, kind=kind)
        return Response(status=status.HTTP_201_CREATED)


def _count_since(qs, since):
    return qs.filter(created_at__gte=since).count()


class MyProfileStatsView(APIView):
    """Métricas del perfil propio: contadores 7d/30d para visitas y contactos."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def get(self, request):
        profile = ModelProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "Primero crea tu perfil."}, status=400)
        now = timezone.now()
        last7, last30 = now - timedelta(days=7), now - timedelta(days=30)
        events = profile.events.all()
        views = events.filter(kind=ProfileEvent.Kind.VIEW)
        contacts = events.filter(kind=ProfileEvent.Kind.CONTACT)
        return Response({
            "views_total": views.count(),
            "views_30d": _count_since(views, last30),
            "views_7d": _count_since(views, last7),
            "contacts_total": contacts.count(),
            "contacts_30d": _count_since(contacts, last30),
            "contacts_7d": _count_since(contacts, last7),
        })
