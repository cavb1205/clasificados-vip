from rest_framework import mixins, permissions, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.models import log_action
from apps.notifications.models import notify_user
from apps.profiles.models import ModelProfile
from core.permissions import IsModerator, IsModel
from .models import MediaContent
from .serializers import MediaContentSerializer


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
