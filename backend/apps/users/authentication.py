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


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        # 1) Authorization header (útil para herramientas/tests). No requiere CSRF.
        header_result = super().authenticate(request)
        if header_result is not None:
            return header_result

        # 2) Cookie HttpOnly.
        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE)
        if not raw_token:
            return None

        validated = self.get_validated_token(raw_token)
        user = self.get_user(validated)

        if request.method not in SAFE_METHODS:
            self._enforce_csrf(request)

        return user, validated

    @staticmethod
    def _enforce_csrf(request):
        check = _CSRFCheck(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
