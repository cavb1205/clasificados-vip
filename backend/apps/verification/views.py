from django.http import HttpResponse, Http404
from rest_framework import generics, permissions
from rest_framework.authentication import SessionAuthentication

from apps.users.authentication import CookieJWTAuthentication
from core.permissions import IsModel
from .models import VerificationAccessLog, VerificationRequest
from .serializers import VerificationRequestSerializer


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


class SubmitVerificationView(generics.CreateAPIView):
    """Endpoint para que la modelo suba sus documentos KYC."""

    serializer_class = VerificationRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]


class KYCDocumentView(generics.GenericAPIView):
    """Descarga descifrada de un documento KYC. Solo staff y siempre auditada.

    Acepta tanto sesión de Django (admin) como cookie JWT — el admin abre el
    link desde /admin/ donde está logueado con session cookie, no con JWT.
    """

    authentication_classes = [SessionAuthentication, CookieJWTAuthentication]
    permission_classes = [permissions.IsAdminUser]
    queryset = VerificationRequest.objects.all()

    def get(self, request, pk, field):
        if field not in {"id_document", "selfie"}:
            raise Http404
        obj = self.get_object()
        data = obj.read_decrypted(field)
        VerificationAccessLog.objects.create(
            request=obj,
            accessed_by=request.user,
            field_name=field,
            ip_address=_client_ip(request),
        )
        # Se sirve en memoria; nunca se escribe el archivo descifrado a disco.
        # Inline + content-type real para verlo en la pestaña sin descargar.
        # Sin caché para que no quede copia en el disco del navegador.
        response = HttpResponse(data, content_type=_sniff_image_mime(data))
        response["Content-Disposition"] = "inline"
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, private, max-age=0"
        response["Pragma"] = "no-cache"
        response["Expires"] = "0"
        response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
        return response


def _sniff_image_mime(data: bytes) -> str:
    """Detecta JPG/PNG/WebP/GIF mirando los primeros bytes (no confiamos en
    extensión porque el archivo en disco se llama '.enc')."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    return "application/octet-stream"
