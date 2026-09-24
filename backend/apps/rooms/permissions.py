"""Permisos específicos del clasificado de habitaciones."""

from rest_framework.permissions import BasePermission

from apps.profiles.models import ModelProfile
from core.permissions import LEGAL_ACCEPTANCE_REQUIRED_MESSAGE, has_current_legal_acceptance


class IsHost(BasePermission):
    """Solo usuarios con rol 'host' (anfitriones)."""

    message = "Necesitas una cuenta de anfitrión para gestionar habitaciones."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated and u.role == "host"):
            return False
        if not has_current_legal_acceptance(u):
            self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
            return False
        return True


def is_active_model(user) -> bool:
    """True si el usuario es una modelo cuyo perfil está públicamente visible.

    Reutiliza la regla centralizada `ModelProfile.objects.publicly_visible()`,
    la misma que decide si una modelo aparece en el portal.
    """
    if not (
        user and user.is_authenticated and getattr(user, "role", "") == "model"
        and has_current_legal_acceptance(user)
    ):
        return False
    return ModelProfile.objects.filter(user=user).publicly_visible().exists()


class IsActiveModel(BasePermission):
    """Solo modelos activas (o staff/moderador) pueden ver las habitaciones."""

    message = "Tu perfil debe estar activo para ver las habitaciones disponibles."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.is_staff:
            return True
        if getattr(u, "role", "") == "moderator":
            if not has_current_legal_acceptance(u):
                self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
                return False
            return True
        if getattr(u, "role", "") == "model" and not has_current_legal_acceptance(u):
            self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
            return False
        return is_active_model(u)
