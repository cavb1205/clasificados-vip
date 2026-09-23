import mimetypes

from django.db import transaction
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import decorators, mixins, permissions, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import log_action
from apps.notifications.models import notify_user
from apps.profiles.models import ModelProfile
from core.permissions import IsModerator, IsModel
from .models import MediaContent, profile_media_limits
from .serializers import MediaContentSerializer, MediaReorderSerializer


def _private_file_response(file_field):
    if not file_field:
        raise Http404
    try:
        stream = file_field.open("rb")
    except (FileNotFoundError, OSError):
        raise Http404
    content_type = mimetypes.guess_type(file_field.name)[0] or "application/octet-stream"
    response = FileResponse(stream, content_type=content_type)
    response["Content-Disposition"] = "inline"
    response["Cache-Control"] = "private, no-store, max-age=0"
    response["X-Content-Type-Options"] = "nosniff"
    response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


class MyMediaViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    """La modelo gestiona la multimedia de su propio perfil."""

    serializer_class = MediaContentSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]

    def _get_profile(self):
        profile = ModelProfile.objects.filter(user=self.request.user).first()
        if profile is None:
            raise PermissionDenied("Primero debes crear tu perfil.")
        return profile

    def get_queryset(self):
        return MediaContent.objects.filter(profile__user=self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        if self.request.method == "POST":
            context["profile"] = self._get_profile()
        return context

    @decorators.action(detail=False, methods=["post"], url_path="reorder")
    def reorder(self, request):
        serializer = MediaReorderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ordered_ids = serializer.validated_data["ids"]

        with transaction.atomic():
            profile = ModelProfile.objects.select_for_update().filter(
                user=request.user
            ).first()
            if profile is None:
                raise PermissionDenied("Primero debes crear un perfil.")

            photos = list(
                MediaContent.objects.select_for_update()
                .filter(profile=profile, media_type=MediaContent.MediaType.PHOTO)
                .order_by("order", "created_at", "pk")
            )
            by_id = {photo.pk: photo for photo in photos}
            if len(ordered_ids) != len(photos) or set(ordered_ids) != set(by_id):
                return Response(
                    {"detail": "La lista de fotos cambió. Actualiza y vuelve a ordenar."},
                    status=status.HTTP_409_CONFLICT,
                )

            for index, photo_id in enumerate(ordered_ids):
                by_id[photo_id].order = index * 10
            MediaContent.objects.bulk_update(photos, ["order"])

        return Response({"updated": len(ordered_ids)})


class PublicMediaFileView(APIView):
    """Sirve una pieza del muro solo si sigue siendo pública y está en cupo."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        item = get_object_or_404(
            MediaContent.objects.select_related("profile"), pk=pk
        )
        if item.is_hidden or not ModelProfile.objects.publicly_visible().filter(
            pk=item.profile_id
        ).exists():
            raise Http404

        max_photos, max_videos = profile_media_limits(item.profile)
        limit = max_photos if item.media_type == MediaContent.MediaType.PHOTO else max_videos
        allowed_ids = item.profile.media.filter(
            media_type=item.media_type, is_hidden=False
        ).values_list("pk", flat=True)[:limit]
        if item.pk not in allowed_ids:
            raise Http404
        return _private_file_response(item.file)


class MyMediaFileView(APIView):
    """Sirve una pieza al dueño del perfil, incluso si no es pública."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def get(self, request, pk):
        item = get_object_or_404(MediaContent, pk=pk, profile__user=request.user)
        return _private_file_response(item.file)


class AdminMediaFileView(APIView):
    """Sirve una pieza al equipo de moderación para revisión administrativa."""

    permission_classes = [IsModerator]

    def get(self, request, pk):
        item = get_object_or_404(MediaContent, pk=pk)
        return _private_file_response(item.file)


class AdminMediaHideView(APIView):
    """Ocultar/mostrar una foto o video puntual del muro (admin o moderador).

    No borra el archivo: solo lo saca del perfil público. Avisa a la modelo y
    queda en la bitácora.
    """

    permission_classes = [IsModerator]

    def post(self, request, pk):
        item = MediaContent.objects.select_related("profile__user").filter(pk=pk).first()
        if not item:
            return Response({"detail": "No encontrado."}, status=404)
        action = (request.data.get("action") or "").lower()
        if action not in ("hide", "unhide"):
            return Response({"detail": "action debe ser hide|unhide"}, status=400)
        item.is_hidden = action == "hide"
        item.save(update_fields=["is_hidden"])
        log_action(
            request.user, f"media.{action}",
            target=f"{item.profile.stage_name} · {item.media_type} #{item.id}",
        )
        if action == "hide":
            notify_user(
                item.profile.user, kind="generic",
                title="Una foto/video fue ocultada",
                message="El equipo ocultó una pieza de tu muro por no cumplir las "
                        "reglas. Puedes reemplazarla desde tu panel.",
            )
        return Response({"id": item.id, "is_hidden": item.is_hidden})
