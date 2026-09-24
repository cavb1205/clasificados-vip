"""Permisos DRF reutilizables basados en el rol del usuario."""

from django.conf import settings
from rest_framework.permissions import BasePermission, SAFE_METHODS

LEGAL_ACCEPTANCE_REQUIRED_MESSAGE = (
    "Revisa y acepta los Términos y la Política de privacidad vigentes desde Mi cuenta para continuar."
)


def has_current_legal_acceptance(user) -> bool:
    if not (user and user.is_authenticated):
        return False
    if user.is_staff or user.is_superuser:
        return True
    if not settings.LEGAL_ACCEPTANCE_ENFORCEMENT:
        return True
    acceptance = user.legal_acceptances.first()
    return bool(
        acceptance
        and acceptance.terms_version == settings.LEGAL_TERMS_VERSION
        and acceptance.privacy_version == settings.LEGAL_PRIVACY_VERSION
    )


class HasCurrentLegalAcceptance(BasePermission):
    message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE

    def has_permission(self, request, view):
        return has_current_legal_acceptance(request.user)


class IsModel(BasePermission):
    """Solo usuarios con rol 'model'."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.role == "model"):
            return False
        if not has_current_legal_acceptance(user):
            self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
            return False
        return True


class IsClient(BasePermission):
    """Solo usuarios con rol 'client'."""

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated and user.role == "client"):
            return False
        if not has_current_legal_acceptance(user):
            self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
            return False
        return True


class IsModerator(BasePermission):
    """Staff (is_staff) o usuarios con rol 'moderator'.

    Para moderación de contenido (reseñas, reportes, listado de modelos).
    Las acciones sensibles (KYC, pagos, planes, suspensión, auditoría)
    siguen detrás de IsAdminUser.
    """

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if not (u.is_staff or getattr(u, "role", "") == "moderator"):
            return False
        if not has_current_legal_acceptance(u):
            self.message = LEGAL_ACCEPTANCE_REQUIRED_MESSAGE
            return False
        return True


class IsOwnerOrReadOnly(BasePermission):
    """Lectura para todos; escritura solo para el dueño del objeto.

    El objeto debe exponer `.user` o `.owner` apuntando al CustomUser dueño.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner == request.user
