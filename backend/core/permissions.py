"""Permisos DRF reutilizables basados en el rol del usuario."""

from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsModel(BasePermission):
    """Solo usuarios con rol 'model'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "model")


class IsClient(BasePermission):
    """Solo usuarios con rol 'client'."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == "client")


class IsOwnerOrReadOnly(BasePermission):
    """Lectura para todos; escritura solo para el dueño del objeto.

    El objeto debe exponer `.user` o `.owner` apuntando al CustomUser dueño.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner == request.user
