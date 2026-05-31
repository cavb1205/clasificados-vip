"""Permisos específicos del clasificado de habitaciones."""

from rest_framework.permissions import BasePermission

from apps.profiles.models import ModelProfile


class IsHost(BasePermission):
    """Solo usuarios con rol 'host' (anfitriones)."""

    message = "Necesitas una cuenta de anfitrión para gestionar habitaciones."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and u.role == "host")


def is_active_model(user) -> bool:
    """True si el usuario es una modelo cuyo perfil está públicamente visible.

    Reutiliza la regla centralizada `ModelProfile.objects.publicly_visible()`,
    la misma que decide si una modelo aparece en el portal.
    """
    if not (user and user.is_authenticated and getattr(user, "role", "") == "model"):
        return False
    return ModelProfile.objects.filter(user=user).publicly_visible().exists()


class IsActiveModel(BasePermission):
    """Solo modelos activas (o staff/moderador) pueden ver las habitaciones."""

    message = "Tu perfil debe estar activo para ver las habitaciones disponibles."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.is_staff or getattr(u, "role", "") == "moderator":
            return True
        return is_active_model(u)
