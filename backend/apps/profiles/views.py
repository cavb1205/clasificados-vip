from datetime import timedelta

from django.db.models import Avg, Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import log_action
from apps.publications.models import Publication
from apps.reviews.models import Review
from core.pagination import AdminPagination
from core.permissions import IsModel, IsModerator
from .models import City, Favorite, ModelProfile, ProfileEvent, ProfileReport, Region, Service
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


def _visible_profile_subquery(city_field_outer, gender=None):
    """Subquery Exists() de perfiles visibles para anclar a city/region.

    Usa la regla de visibilidad pública centralizada en
    `ModelProfile.objects.publicly_visible()`. Opcionalmente restringe por género.
    """
    profiles = ModelProfile.objects.filter(city_field_outer).publicly_visible()
    if gender:
        profiles = profiles.filter(gender=gender)
    return Exists(profiles)


class RegionListView(generics.ListAPIView):
    serializer_class = RegionSerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = Region.objects.all()
        # ?has_profiles=true → solo regiones que tienen al menos una comuna
        # con perfiles visibles. ?gender= restringe por categoría.
        if self.request.query_params.get("has_profiles") == "true":
            gender = self.request.query_params.get("gender")
            qs = qs.annotate(
                _has=_visible_profile_subquery(Q(city__region=OuterRef("pk")), gender=gender)
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
        # ?gender= restringe por categoría.
        if self.request.query_params.get("has_profiles") == "true":
            gender = self.request.query_params.get("gender")
            qs = qs.annotate(
                _has=_visible_profile_subquery(Q(city=OuterRef("pk")), gender=gender)
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

    @action(detail=False, methods=["post"], url_path="availability")
    def availability(self, request):
        """Activa o cancela 'Disponible ahora' para el perfil propio.

        Body: {"minutes": 60} o {"cancel": true}
        """
        profile = ModelProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response(
                {"detail": "Primero crea tu perfil."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if request.data.get("cancel"):
            profile.available_until = None
        else:
            try:
                minutes = int(request.data.get("minutes", 0))
            except (TypeError, ValueError):
                minutes = 0
            if not (15 <= minutes <= 24 * 60):
                return Response(
                    {"detail": "Duración inválida (15 min – 24 h)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            from datetime import timedelta
            profile.available_until = timezone.now() + timedelta(minutes=minutes)
        profile.save(update_fields=["available_until"])
        return Response({
            "available_until": profile.available_until,
            "is_available_now": profile.is_available_now,
        })

    @action(detail=False, methods=["post", "delete"], url_path="avatar")
    def avatar(self, request):
        """Sube (POST, multipart 'upload') o quita (DELETE) la foto de perfil.

        La imagen pasa por el pipeline de privacidad (EXIF/GPS + marca + JPEG).
        """
        from core.image_processing import process_image

        profile = ModelProfile.objects.filter(user=request.user).first()
        if not profile:
            return Response({"detail": "Primero crea tu perfil."}, status=400)

        if request.method == "DELETE":
            if profile.avatar:
                profile.avatar.delete(save=False)
            profile.avatar = None
            profile.save(update_fields=["avatar"])
            return Response({"avatar": None})

        upload = request.FILES.get("upload") or request.FILES.get("avatar")
        if not upload:
            return Response({"detail": "Falta el archivo."}, status=400)
        processed = process_image(upload.read(), filename_stem="avatar")
        if profile.avatar:
            profile.avatar.delete(save=False)
        profile.avatar.save(processed.name, processed, save=True)
        return Response({"avatar": request.build_absolute_uri(profile.avatar.url)})


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
        # Visibilidad: verificada Y (en trial gratuito O con publicación activa).
        qs = annotate_public_profiles(
            ModelProfile.objects.publicly_visible()
            .distinct()
            .select_related("city", "city__region")
            .prefetch_related("services", "media")
        )

        region = self.kwargs.get("region") or params.get("region")
        city = self.kwargs.get("city") or params.get("city")
        gender = params.get("gender")
        if region:
            qs = qs.filter(city__region__slug=region)
        if city:
            qs = qs.filter(city__slug=city)
        if gender in (
            ModelProfile.Gender.FEMALE,
            ModelProfile.Gender.TRANS,
            ModelProfile.Gender.MALE,
        ):
            qs = qs.filter(gender=gender)

        # Solo perfiles "Disponibles ahora" (available_until en el futuro).
        if params.get("available_now") == "true":
            qs = qs.filter(available_until__gt=timezone.now())

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
        return annotate_public_profiles(
            ModelProfile.objects.publicly_visible()
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
            slug=slug,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            is_suspended=False,
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


# ─── Admin: gestión de modelos y publicaciones ──────────────────────────────
from rest_framework import serializers as drf_serializers  # noqa: E402


class AdminModelProfileSerializer(drf_serializers.ModelSerializer):
    user_id = drf_serializers.IntegerField(source="user.id", read_only=True)
    email = drf_serializers.CharField(source="user.email", read_only=True)
    username = drf_serializers.CharField(source="user.username", read_only=True)
    city_name = drf_serializers.CharField(source="city.name", read_only=True, default=None)
    active_publication_count = drf_serializers.SerializerMethodField()

    class Meta:
        model = ModelProfile
        fields = [
            "id", "user_id", "stage_name", "slug", "gender", "age", "email", "username",
            "city_name", "verification_status", "is_suspended",
            "suspension_reason", "photo_authenticity", "created_at", "active_publication_count",
        ]

    def get_active_publication_count(self, obj):
        from apps.publications.models import Publication
        return Publication.objects.filter(
            profile=obj,
            status=Publication.Status.ACTIVE,
            expires_at__gt=timezone.now(),
        ).count()


class AdminModelProfileListView(generics.ListAPIView):
    """Lectura del listado de modelos (admin y moderador)."""

    from core.permissions import IsModerator as _IsModerator  # noqa: N806
    serializer_class = AdminModelProfileSerializer
    permission_classes = [_IsModerator]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = ModelProfile.objects.select_related("user", "city")
        q = (self.request.query_params.get("q") or "").strip()
        status_filter = self.request.query_params.get("status")
        if q:
            qs = qs.filter(
                Q(stage_name__icontains=q)
                | Q(slug__icontains=q)
                | Q(user__email__icontains=q)
                | Q(user__username__icontains=q)
                | Q(city__name__icontains=q)
            )
        if status_filter == "pending":
            qs = qs.filter(verification_status=ModelProfile.VerificationStatus.PENDING)
        elif status_filter == "verified":
            qs = qs.filter(verification_status=ModelProfile.VerificationStatus.VERIFIED)
        elif status_filter == "rejected":
            qs = qs.filter(verification_status=ModelProfile.VerificationStatus.REJECTED)
        elif status_filter == "suspended":
            qs = qs.filter(is_suspended=True)
        return qs


class AdminModelProfileActionView(generics.GenericAPIView):
    # Suspender/reactivar lo puede hacer admin o moderador.
    permission_classes = [IsModerator]
    queryset = ModelProfile.objects.all()

    def post(self, request, pk):
        profile = self.get_object()
        action = (request.data.get("action") or "").lower()
        if action == "suspend":
            profile.is_suspended = True
            profile.suspension_reason = (request.data.get("reason") or "")[:200]
            profile.save(update_fields=["is_suspended", "suspension_reason"])
        elif action == "unsuspend":
            profile.is_suspended = False
            profile.suspension_reason = ""
            profile.save(update_fields=["is_suspended", "suspension_reason"])
        elif action == "set_authenticity":
            value = (request.data.get("value") or "").lower()
            if value not in dict(ModelProfile.PhotoAuthenticity.choices):
                return Response({"detail": "Nivel inválido."}, status=400)
            profile.photo_authenticity = value
            profile.save(update_fields=["photo_authenticity"])
            log_action(request.user, "model.set_authenticity",
                       target=f"{profile.stage_name} (#{profile.id})", note=value)
            return Response(AdminModelProfileSerializer(profile).data)
        else:
            return Response({"detail": "action debe ser suspend|unsuspend|set_authenticity"}, status=400)
        log_action(request.user, f"model.{action}",
                   target=f"{profile.stage_name} (#{profile.id})", note=request.data.get("reason") or "")
        return Response(AdminModelProfileSerializer(profile).data)


class AdminProfileDetailView(APIView):
    """Ficha unificada de una modelo para moderación (admin y moderador):
    publicaciones, pagos, reportes y acciones recientes en un solo lugar."""

    permission_classes = [IsModerator]

    def get(self, request, pk):
        profile = ModelProfile.objects.select_related("user", "city").filter(pk=pk).first()
        if not profile:
            return Response({"detail": "No encontrado."}, status=404)
        from apps.audit.models import AdminActionLog
        from apps.publications.models import PaymentReceipt

        def _abs(url):
            return request.build_absolute_uri(url) if request else url

        media = [
            {
                "id": m.id, "media_type": m.media_type,
                "url": _abs(m.file.url) if m.file else None,
                "is_hidden": m.is_hidden,
            }
            for m in profile.media.all()
        ]
        publications = [
            {
                "id": p.id, "title": p.title, "status": p.status,
                "is_featured": p.is_featured, "is_live": p.is_live,
                "expires_at": p.expires_at,
                "plan_name": p.plan.name if p.plan else None,
            }
            for p in profile.publications.select_related("plan").all()
        ]
        receipts = [
            {
                "id": r.id, "amount": r.amount, "status": r.status,
                "publication_title": r.publication.title,
                "created_at": r.created_at, "reviewed_at": r.reviewed_at,
            }
            for r in (
                PaymentReceipt.objects.filter(publication__profile=profile)
                .select_related("publication").order_by("-created_at")[:15]
            )
        ]
        reports = [
            {
                "id": rp.id, "reason": rp.reason,
                "reporter_email": getattr(rp.reporter, "email", None),
                "created_at": rp.created_at,
            }
            for rp in profile.reports.select_related("reporter").order_by("-created_at")[:15]
        ]
        actions = [
            {
                "action": a.action, "actor_email": getattr(a.actor, "email", None),
                "note": a.note, "created_at": a.created_at,
            }
            for a in (
                AdminActionLog.objects.filter(
                    Q(target__icontains=profile.user.email)
                    | Q(target__icontains=profile.stage_name)
                ).select_related("actor").order_by("-created_at")[:15]
            )
        ]
        return Response({
            "profile": AdminModelProfileSerializer(profile).data,
            "media": media,
            "publications": publications,
            "receipts": receipts,
            "reports": reports,
            "recent_actions": actions,
        })


# ─── Favoritos (clientes) ────────────────────────────────────────────────────
from rest_framework.throttling import ScopedRateThrottle  # noqa: E402


def _get_profile_or_404(slug):
    profile = ModelProfile.objects.filter(slug=slug).first()
    if not profile:
        from django.http import Http404
        raise Http404
    return profile


class FavoriteToggleView(APIView):
    """POST: agrega/quita el perfil de favoritos del usuario. Devuelve {favorited}."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, slug):
        profile = _get_profile_or_404(slug)
        fav = Favorite.objects.filter(user=request.user, profile=profile).first()
        if fav:
            fav.delete()
            return Response({"favorited": False})
        Favorite.objects.create(user=request.user, profile=profile)
        return Response({"favorited": True}, status=status.HTTP_201_CREATED)


class MyFavoritesListView(generics.ListAPIView):
    """Perfiles que el usuario guardó como favoritos."""

    serializer_class = PublicProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return annotate_public_profiles(
            ModelProfile.objects.filter(favorited_by__user=self.request.user)
            .select_related("city", "city__region")
            .prefetch_related("services", "media")
            .order_by("-favorited_by__created_at")
        )


# ─── Reportes de perfiles ────────────────────────────────────────────────────
class ProfileReportView(APIView):
    """Cualquiera puede reportar un perfil por contenido inapropiado."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def post(self, request, slug):
        profile = _get_profile_or_404(slug)
        reason = (request.data.get("reason") or "")[:200].strip()
        reporter = request.user if request.user.is_authenticated else None
        ProfileReport.objects.create(profile=profile, reporter=reporter, reason=reason)
        return Response({"detail": "Gracias por el reporte."}, status=status.HTTP_201_CREATED)


class AdminProfileReportSerializer(drf_serializers.ModelSerializer):
    profile_slug = drf_serializers.CharField(source="profile.slug", read_only=True)
    stage_name = drf_serializers.CharField(source="profile.stage_name", read_only=True)
    is_suspended = drf_serializers.BooleanField(source="profile.is_suspended", read_only=True)
    reporter_email = drf_serializers.CharField(source="reporter.email", read_only=True, default=None)

    class Meta:
        model = ProfileReport
        fields = ["id", "profile_slug", "stage_name", "is_suspended",
                  "reporter_email", "reason", "created_at"]


class AdminProfileReportQueueView(generics.ListAPIView):
    from core.permissions import IsModerator as _IsModerator  # noqa: N806
    serializer_class = AdminProfileReportSerializer
    permission_classes = [_IsModerator]

    def get_queryset(self):
        return ProfileReport.objects.select_related("profile", "reporter").order_by("-created_at")


class AdminProfileReportActionView(generics.GenericAPIView):
    """POST {action: 'suspend' | 'dismiss'}."""

    permission_classes = [permissions.IsAdminUser]
    queryset = ProfileReport.objects.all()

    def post(self, request, pk):
        report = self.get_object()
        action = (request.data.get("action") or "").lower()
        if action == "suspend":
            p = report.profile
            p.is_suspended = True
            p.suspension_reason = (request.data.get("reason") or "Reportada")[:200]
            p.save(update_fields=["is_suspended", "suspension_reason"])
            return Response({"detail": "Perfil suspendido."})
        if action == "dismiss":
            report.delete()
            return Response({"detail": "Reporte descartado."})
        return Response({"detail": "action debe ser suspend|dismiss"}, status=400)
