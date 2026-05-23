from rest_framework import mixins, permissions, viewsets
from rest_framework.exceptions import PermissionDenied

from apps.profiles.models import ModelProfile
from core.permissions import IsModel
from .models import MediaContent
from .serializers import MediaContentSerializer


class MyMediaViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
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
