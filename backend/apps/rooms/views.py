from django.http import Http404, HttpResponse
from rest_framework import generics, mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.publications.models import SubscriptionPlan
from core.image_processing import process_image
from core.permissions import IsModerator

from .models import HostProfile, RoomListing, RoomPhoto, RoomReceipt, RoomReport
from .permissions import IsActiveModel, IsHost, is_active_model
from .serializers import (
    HostProfileSerializer,
    PublicRoomListingSerializer,
    RoomListingSerializer,
    RoomPhotoSerializer,
    RoomPlanSerializer,
    RoomReceiptSerializer,
)


# ─── Anfitrión: perfil, plan, anuncios, fotos ───────────────────────────────
class RoomPlanListView(generics.ListAPIView):
    """Planes de habitación disponibles (configurados por el admin)."""

    serializer_class = RoomPlanSerializer
    permission_classes = [permissions.AllowAny]
    queryset = SubscriptionPlan.objects.filter(
        is_active=True, kind=SubscriptionPlan.Kind.ROOM_LISTING
    )


class MyHostProfileView(APIView):
    """El anfitrión consulta/crea/edita su perfil y ve el estado de su plan."""

    permission_classes = [permissions.IsAuthenticated, IsHost]

    def _get(self, request):
        return HostProfile.objects.filter(user=request.user).first()

    def get(self, request):
        profile = self._get(request)
        if not profile:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(HostProfileSerializer(profile).data)

    def post(self, request):
        if self._get(request):
            raise PermissionDenied("Ya tienes un perfil de anfitrión.")
        serializer = HostProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def put(self, request):
        profile = self._get(request)
        if not profile:
            raise PermissionDenied("Primero crea tu perfil de anfitrión.")
        serializer = HostProfileSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


def _require_host(user):
    host = HostProfile.objects.filter(user=user).first()
    if host is None:
        raise PermissionDenied("Primero completa tu perfil de anfitrión.")
    return host


class MyRoomSubscriptionView(APIView):
    """El anfitrión contrata/renueva su plan subiendo un comprobante.

    POST multipart: {plan_id, image, amount?} → crea un RoomReceipt pendiente.
    Al aprobarlo el admin, el plan queda activo y habilita los cupos.
    """

    permission_classes = [permissions.IsAuthenticated, IsHost]

    def post(self, request):
        host = _require_host(request.user)
        serializer = RoomReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(owner=host)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MyRoomViewSet(viewsets.ModelViewSet):
    """El anfitrión gestiona sus habitaciones (borrador → publicar contra su plan)."""

    serializer_class = RoomListingSerializer
    permission_classes = [permissions.IsAuthenticated, IsHost]

    def get_queryset(self):
        return RoomListing.objects.filter(
            owner__user=self.request.user
        ).prefetch_related("photos")

    def perform_create(self, serializer):
        host = _require_host(self.request.user)
        extra = {}
        if not serializer.validated_data.get("whatsapp"):
            extra["whatsapp"] = host.whatsapp
        if not serializer.validated_data.get("phone"):
            extra["phone"] = host.phone
        serializer.save(owner=host, **extra)

    @action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        """Publica una pieza contra la suscripción del anfitrión (consume un cupo)."""
        listing = self.get_object()
        host = listing.owner
        if listing.status == RoomListing.Status.ACTIVE:
            return Response({"detail": "La habitación ya está publicada."}, status=400)
        if not host.subscription_active:
            raise ValidationError(
                "Necesitas un plan activo para publicar. Contrata o renueva tu plan."
            )
        if host.available_slots() <= 0:
            raise ValidationError(
                f"Alcanzaste el tope de tu plan ({host.slots_cap()} habitación(es) "
                f"activas). Despublica otra o contrata un plan mayor."
            )
        listing.publish()
        return Response(RoomListingSerializer(listing, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def unpublish(self, request, pk=None):
        """Vuelve la pieza a borrador y libera el cupo."""
        listing = self.get_object()
        listing.unpublish()
        return Response(RoomListingSerializer(listing, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        """Pausa una pieza publicada (ocupada) sin liberar el cupo."""
        listing = self.get_object()
        listing.is_paused = True
        listing.save(update_fields=["is_paused", "updated_at"])
        return Response(RoomListingSerializer(listing, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def resume(self, request, pk=None):
        """Reactiva una pieza pausada."""
        listing = self.get_object()
        listing.is_paused = False
        listing.save(update_fields=["is_paused", "updated_at"])
        return Response(RoomListingSerializer(listing, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def availability(self, request, pk=None):
        """Activa/cancela 'Disponible ahora'. Body: {"minutes": 60} o {"cancel": true}."""
        from datetime import timedelta
        from django.utils import timezone

        listing = self.get_object()
        if request.data.get("cancel"):
            listing.available_until = None
        else:
            try:
                minutes = int(request.data.get("minutes", 0))
            except (TypeError, ValueError):
                minutes = 0
            if not (15 <= minutes <= 12 * 60):
                return Response({"detail": "Duración inválida (15 min – 12 h)."}, status=400)
            listing.available_until = timezone.now() + timedelta(minutes=minutes)
        listing.save(update_fields=["available_until", "updated_at"])
        return Response(RoomListingSerializer(listing, context={"request": request}).data)


class MyRoomPhotoViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """Fotos de las habitaciones del anfitrión (subir, reordenar, borrar)."""

    serializer_class = RoomPhotoSerializer
    permission_classes = [permissions.IsAuthenticated, IsHost]

    def get_queryset(self):
        return RoomPhoto.objects.filter(listing__owner__user=self.request.user)

    def _get_listing(self):
        listing_id = self.request.data.get("listing")
        listing = RoomListing.objects.filter(
            pk=listing_id, owner__user=self.request.user
        ).first()
        if listing is None:
            raise PermissionDenied("Habitación inexistente o ajena.")
        return listing

    def perform_create(self, serializer):
        from django.conf import settings

        listing = self._get_listing()
        if listing.photos.count() >= settings.MAX_PHOTOS_PER_ROOM:
            raise PermissionDenied(
                f"Límite alcanzado: máximo {settings.MAX_PHOTOS_PER_ROOM} fotos por habitación."
            )
        upload = serializer.validated_data.pop("upload")
        # Pipeline: elimina EXIF/GPS (crítico para no filtrar ubicación) + marca + JPEG.
        processed = process_image(upload.read(), filename_stem="room")
        photo = RoomPhoto(listing=listing, order=serializer.validated_data.get("order", 0))
        photo.image.save(processed.name, processed, save=False)
        photo.save()
        serializer.instance = photo


class RoomPhotoFileView(APIView):
    """Sirve una foto de habitación desde el storage privado, tras el gate.

    Visible para: el anfitrión dueño, cualquier modelo activa, o staff/moderador.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        photo = RoomPhoto.objects.filter(pk=pk).select_related("listing__owner").first()
        if not photo:
            raise Http404
        u = request.user
        is_owner = photo.listing.owner.user_id == u.id
        allowed = (
            is_owner
            or u.is_staff
            or getattr(u, "role", "") == "moderator"
            or is_active_model(u)
        )
        if not allowed:
            raise PermissionDenied(
                "Tu perfil debe estar activo para ver las habitaciones disponibles."
            )
        photo.image.open("rb")
        try:
            data = photo.image.read()
        finally:
            photo.image.close()
        response = HttpResponse(data, content_type="image/jpeg")
        response["Cache-Control"] = "private, max-age=300"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        return response


# ─── Modelo activa: navegar habitaciones ────────────────────────────────────
class PublicRoomListView(generics.ListAPIView):
    """Habitaciones vigentes en todas las ciudades. Solo para modelos activas."""

    serializer_class = PublicRoomListingSerializer
    permission_classes = [IsActiveModel]

    def get_queryset(self):
        from django.utils import timezone

        qs = (
            RoomListing.objects.filter(
                status=RoomListing.Status.ACTIVE,
                is_paused=False,
                is_suspended=False,
                expires_at__gt=timezone.now(),
            )
            .select_related("city", "city__region")
            .prefetch_related("photos")
        )
        params = self.request.query_params
        region = params.get("region")
        city = params.get("city")
        period = params.get("price_period")
        if region:
            qs = qs.filter(city__region__slug=region)
        if city:
            qs = qs.filter(city__slug=city)
        if period in RoomListing.PricePeriod.values:
            qs = qs.filter(price_period=period)
        if params.get("available_now") == "true":
            qs = qs.filter(available_until__gt=timezone.now())
        # Orden: disponibles ahora primero, luego destacadas, luego recientes.
        # (anotación booleana para que el orden de NULLs sea consistente entre DBs)
        from django.db.models import BooleanField, Case, Value, When

        return qs.annotate(
            _avail=Case(
                When(available_until__gt=timezone.now(), then=Value(True)),
                default=Value(False),
                output_field=BooleanField(),
            )
        ).order_by("-_avail", "-is_featured", "-created_at")


class RoomReportView(APIView):
    """Una modelo activa reporta una habitación por contenido inapropiado."""

    permission_classes = [IsActiveModel]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "report"

    def post(self, request, pk):
        listing = RoomListing.objects.filter(pk=pk).first()
        if not listing:
            raise Http404
        reason = (request.data.get("reason") or "")[:200].strip()
        RoomReport.objects.create(listing=listing, reporter=request.user, reason=reason)
        return Response({"detail": "Gracias por el reporte."}, status=status.HTTP_201_CREATED)


class PublicRoomDetailView(generics.RetrieveAPIView):
    serializer_class = PublicRoomListingSerializer
    permission_classes = [IsActiveModel]

    def get_queryset(self):
        from django.utils import timezone

        return RoomListing.objects.filter(
            status=RoomListing.Status.ACTIVE,
            is_paused=False,
            is_suspended=False,
            expires_at__gt=timezone.now(),
        ).select_related("city", "city__region").prefetch_related("photos")


# ─── Admin/moderador: cola de pagos y moderación ────────────────────────────
from rest_framework import serializers as drf_serializers  # noqa: E402


class AdminRoomReceiptSerializer(drf_serializers.ModelSerializer):
    host_name = drf_serializers.CharField(source="owner.display_name", read_only=True)
    host_email = drf_serializers.CharField(source="owner.user.email", read_only=True)
    plan_name = drf_serializers.CharField(source="plan.name", read_only=True, default="")
    plan_price = drf_serializers.IntegerField(source="plan.price", read_only=True, default=None)
    plan_slots = drf_serializers.IntegerField(source="plan.max_listings", read_only=True, default=None)
    image_url = drf_serializers.SerializerMethodField()

    class Meta:
        model = RoomReceipt
        fields = [
            "id", "host_name", "host_email", "plan_name", "plan_price", "plan_slots",
            "amount", "status", "note", "image_url", "created_at", "reviewed_at",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if not obj.image:
            return None
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url


class AdminRoomPaymentQueueView(generics.ListAPIView):
    serializer_class = AdminRoomReceiptSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        qs = RoomReceipt.objects.select_related("owner", "owner__user", "plan")
        s = self.request.query_params.get("status", "pending")
        if s in {"pending", "approved", "rejected"}:
            qs = qs.filter(status=s)
        return qs


class AdminRoomPaymentActionView(generics.GenericAPIView):
    permission_classes = [permissions.IsAdminUser]
    queryset = RoomReceipt.objects.all()

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
            AdminRoomReceiptSerializer(receipt, context={"request": request}).data
        )


class AdminRoomSerializer(drf_serializers.ModelSerializer):
    host_name = drf_serializers.CharField(source="owner.display_name", read_only=True)
    host_email = drf_serializers.CharField(source="owner.user.email", read_only=True)
    city_name = drf_serializers.CharField(source="city.name", read_only=True, default=None)
    photo_count = drf_serializers.IntegerField(source="photos.count", read_only=True)
    # Fotos para moderación (el endpoint gateado permite staff/moderador).
    photos = RoomPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = RoomListing
        fields = [
            "id", "title", "description", "host_name", "host_email", "city_name", "sector",
            "price", "price_period", "status", "is_featured", "is_paused",
            "is_suspended", "suspension_reason", "expires_at", "photo_count",
            "photos", "created_at",
        ]


class AdminRoomListView(generics.ListAPIView):
    """Listado de habitaciones para moderación (admin y moderador)."""

    serializer_class = AdminRoomSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        from django.db.models import Q

        qs = RoomListing.objects.select_related("owner__user", "city").prefetch_related("photos")
        q = (self.request.query_params.get("q") or "").strip()
        status_filter = self.request.query_params.get("status")
        if q:
            qs = qs.filter(
                Q(title__icontains=q)
                | Q(owner__display_name__icontains=q)
                | Q(owner__user__email__icontains=q)
                | Q(city__name__icontains=q)
            )
        if status_filter in RoomListing.Status.values:
            qs = qs.filter(status=status_filter)
        elif status_filter == "suspended":
            qs = qs.filter(is_suspended=True)
        return qs[:100]


class AdminRoomActionView(generics.GenericAPIView):
    """Suspender / reactivar un anuncio de habitación (solo admin)."""

    permission_classes = [permissions.IsAdminUser]
    queryset = RoomListing.objects.all()

    def post(self, request, pk):
        listing = self.get_object()
        action_kind = (request.data.get("action") or "").lower()
        if action_kind == "suspend":
            listing.is_suspended = True
            listing.suspension_reason = (request.data.get("reason") or "")[:200]
            listing.save(update_fields=["is_suspended", "suspension_reason", "updated_at"])
        elif action_kind == "unsuspend":
            listing.is_suspended = False
            listing.suspension_reason = ""
            listing.save(update_fields=["is_suspended", "suspension_reason", "updated_at"])
        else:
            return Response({"detail": "action debe ser suspend|unsuspend"}, status=400)
        return Response(AdminRoomSerializer(listing).data)


class AdminRoomReportSerializer(drf_serializers.ModelSerializer):
    listing_id = drf_serializers.IntegerField(source="listing.id", read_only=True)
    listing_title = drf_serializers.CharField(source="listing.title", read_only=True)
    is_suspended = drf_serializers.BooleanField(source="listing.is_suspended", read_only=True)
    reporter_email = drf_serializers.CharField(source="reporter.email", read_only=True, default=None)

    class Meta:
        model = RoomReport
        fields = ["id", "listing_id", "listing_title", "is_suspended",
                  "reporter_email", "reason", "created_at"]


class AdminRoomReportQueueView(generics.ListAPIView):
    serializer_class = AdminRoomReportSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return RoomReport.objects.select_related("listing", "reporter").order_by("-created_at")


class AdminRoomReportActionView(generics.GenericAPIView):
    """POST {action: 'suspend' | 'dismiss'}. 'suspend' oculta la habitación."""

    permission_classes = [permissions.IsAdminUser]
    queryset = RoomReport.objects.all()

    def post(self, request, pk):
        report = self.get_object()
        action_kind = (request.data.get("action") or "").lower()
        if action_kind == "suspend":
            listing = report.listing
            listing.is_suspended = True
            listing.suspension_reason = (request.data.get("reason") or "Reportada")[:200]
            listing.save(update_fields=["is_suspended", "suspension_reason", "updated_at"])
            return Response({"detail": "Habitación suspendida."})
        if action_kind == "dismiss":
            report.delete()
            return Response({"detail": "Reporte descartado."})
        return Response({"detail": "action debe ser suspend|dismiss"}, status=400)
