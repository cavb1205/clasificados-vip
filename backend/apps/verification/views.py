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
        return HttpResponse(data, content_type="application/octet-stream")
