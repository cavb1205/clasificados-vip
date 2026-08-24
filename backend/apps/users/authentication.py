"""Autenticación JWT leyendo el access token desde una cookie HttpOnly.

El frontend nunca ve el token en JS (mitiga XSS). Como el transporte es por
cookie, en métodos de escritura se exige además token CSRF válido (mitiga CSRF),
replicando el comportamiento que DRF aplica a la SessionAuthentication.
"""

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


class _CSRFCheck(CsrfViewMiddleware):
    def _reject(self, request, reason):
        return reason


def enforce_csrf(request):
    """Exige CSRF para endpoints que no pasan por CookieJWTAuthentication.

    El endpoint de refresh debe poder ejecutarse cuando el access token ya
    expiró, por lo que no puede depender de autenticar primero la cookie JWT.
    """
    check = _CSRFCheck(lambda req: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")


def ensure_current_session(user, token):
    """Rechaza tokens emitidos antes de un cambio de contraseña/sesión."""
    try:
        token_version = int(token.get("session_version", 0))
    except (TypeError, ValueError):
        raise exceptions.AuthenticationFailed("La sesión ya no es válida.")
    if token_version != user.session_version:
        raise exceptions.AuthenticationFailed("La sesión ya no es válida.")


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # 1) Authorization header (útil para herramientas/tests). No requiere CSRF.
        header_result = super().authenticate(request)
        if header_result is not None:
            user, validated = header_result
            ensure_current_session(user, validated)
            return user, validated

        # 2) Cookie HttpOnly.
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if not raw_token:
            return None

        validated = self.get_validated_token(raw_token)
        user = self.get_user(validated)

        ensure_current_session(user, validated)

        if request.method not in SAFE_METHODS:
            enforce_csrf(request)

        return user, validated
