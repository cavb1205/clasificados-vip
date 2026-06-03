from django.http import HttpResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.authentication import SessionAuthentication
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification, notify_user
from apps.profiles.models import ModelProfile
from apps.users.authentication import CookieJWTAuthentication
from core.permissions import IsModel
from .models import VerificationAccessLog, VerificationChallenge, VerificationRequest
from .serializers import AdminQueueSerializer, VerificationRequestSerializer


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


def _sync_profile_on_decision(user, status_value):
    """Refleja la decisión de KYC en el ModelProfile (verified_at first-time only)."""
    profile = ModelProfile.objects.filter(user=user).first()
    if not profile:
        return
    profile.verification_status = status_value
    fields = ["verification_status"]
    if status_value == ModelProfile.VerificationStatus.VERIFIED and profile.verified_at is None:
        profile.verified_at = timezone.now()
        fields.append("verified_at")
    profile.save(update_fields=fields)


class AdminKYCQueueView(generics.ListAPIView):
    """Lista de verificaciones pendientes para moderar desde el panel frontend."""

    serializer_class = AdminQueueSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = None

    def get_queryset(self):
        return VerificationRequest.objects.filter(
            status=VerificationRequest.Status.PENDING
        ).select_related("user").order_by("created_at")


class AdminKYCActionView(APIView):
    """POST con `decision` ('approve'|'reject') y `reason` opcional."""

    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        vr = get_object_or_404(VerificationRequest, pk=pk)
        decision = request.data.get("decision")
        reason = request.data.get("reason", "").strip()

        if vr.status != VerificationRequest.Status.PENDING:
            return Response(
                {"detail": "Esta solicitud ya fue revisada."},
                status=status.HTTP_409_CONFLICT,
            )

        if decision == "approve":
            if not vr.consent_video:
                return Response(
                    {"detail": "No se puede aprobar sin video de consentimiento."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            vr.status = VerificationRequest.Status.VERIFIED
            vr.reviewed_by = request.user
            vr.reviewed_at = timezone.now()
            vr.save(update_fields=["status", "reviewed_by", "reviewed_at"])
            _sync_profile_on_decision(vr.user, ModelProfile.VerificationStatus.VERIFIED)
            from apps.audit.models import log_action
            log_action(request.user, "kyc.approve", target=f"{vr.user.email} (VR#{vr.id})")
            notify_user(
                vr.user, kind=Notification.Kind.KYC,
                title="✅ Verificación aprobada",
                message="Tu identidad fue verificada. Trial gratuito activo.",
                link="/dashboard",
            )
            return Response({"status": "verified"})

        if decision == "reject":
            vr.status = VerificationRequest.Status.REJECTED
            vr.reviewed_by = request.user
            vr.reviewed_at = timezone.now()
            vr.rejection_reason = reason
            vr.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason"])
            _sync_profile_on_decision(vr.user, ModelProfile.VerificationStatus.REJECTED)
            from apps.audit.models import log_action
            log_action(request.user, "kyc.reject", target=f"{vr.user.email} (VR#{vr.id})", note=reason)
            notify_user(
                vr.user, kind=Notification.Kind.KYC,
                title="Verificación rechazada",
                message=reason or "Revisa tus documentos y vuelve a enviarlos.",
                link="/dashboard",
            )
            return Response({"status": "rejected"})

        return Response(
            {"detail": "decision debe ser 'approve' o 'reject'."},
            status=status.HTTP_400_BAD_REQUEST,
        )


# ─── Auditoría KYC ──────────────────────────────────────────────────────────
from rest_framework import generics, serializers as drf_serializers  # noqa: E402
from .models import VerificationAccessLog  # noqa: E402


class KYCAccessLogSerializer(drf_serializers.ModelSerializer):
    request_id = drf_serializers.IntegerField(source="request.id", read_only=True)
    target_email = drf_serializers.CharField(source="request.user.email", read_only=True)
    accessed_by_email = drf_serializers.CharField(
        source="accessed_by.email", read_only=True, default=None
    )

    class Meta:
        model = VerificationAccessLog
        fields = [
            "id", "request_id", "target_email", "accessed_by_email",
            "field_name", "accessed_at", "ip_address",
        ]


class AdminKYCAuditView(generics.ListAPIView):
    serializer_class = KYCAccessLogSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return VerificationAccessLog.objects.select_related(
            "request", "request__user", "accessed_by"
        )[:200]
