from django.http import HttpResponse, Http404
from rest_framework import generics, permissions
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.authentication import CookieJWTAuthentication
from core.permissions import IsModel
from .models import VerificationAccessLog, VerificationChallenge, VerificationRequest
from .serializers import VerificationRequestSerializer


def _client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    return xff.split(",")[0].strip() if xff else request.META.get("REMOTE_ADDR")


class SubmitVerificationView(generics.CreateAPIView):
    """Endpoint para que la modelo suba sus documentos KYC."""

    serializer_class = VerificationRequestSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]


class IssueChallengeView(APIView):
    """Genera el código aleatorio + texto guionado para el video de consentimiento."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def post(self, request):
        challenge = VerificationChallenge.issue(request.user)
        statement = (
            "Yo, la persona que aparece en la cédula que estoy mostrando, "
            "mayor de edad, hoy "
            f"{challenge.created_at.strftime('%d/%m/%Y')}, confirmo que quiero "
            "publicar mi perfil y servicios en la plataforma Clasificados VIP "
            "de forma libre y voluntaria, sin coerción de ninguna persona. "
            f"Código de validación: {challenge.code}."
        )
        return Response({
            "code": challenge.code,
            "expires_at": challenge.expires_at.isoformat(),
            "statement": statement,
        })


class KYCDocumentView(generics.GenericAPIView):
    """Descarga descifrada de un documento KYC. Solo staff y siempre auditada.

    Acepta tanto sesión de Django (admin) como cookie JWT — el admin abre el
    link desde /admin/ donde está logueado con session cookie, no con JWT.
    """

    authentication_classes = [SessionAuthentication, CookieJWTAuthentication]
    permission_classes = [permissions.IsAdminUser]
    queryset = VerificationRequest.objects.all()

    def get(self, request, pk, field):
        if field not in {"id_document", "selfie", "consent_video"}:
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
    """Detecta MIME por los primeros bytes (no confiamos en extensión: el
    archivo en disco se llama '.enc' porque está cifrado)."""
    # Imágenes
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) > 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    # Videos
    if len(data) > 12 and data[4:8] == b"ftyp":
        # MP4/MOV/M4V. Subtipo en data[8:12] (mp4, isom, qt, M4V, etc.).
        return "video/mp4" if data[8:12] != b"qt  " else "video/quicktime"
    if data.startswith(b"\x1a\x45\xdf\xa3"):  # EBML → WebM/Matroska
        return "video/webm"
    return "application/octet-stream"
