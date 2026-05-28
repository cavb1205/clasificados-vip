from django.contrib import admin, messages
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

from apps.notifications.models import Notification, notify_user
from apps.profiles.models import ModelProfile
from .models import VerificationAccessLog, VerificationRequest


@admin.register(VerificationRequest)
class VerificationRequestAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "created_at", "reviewed_by", "documents")
    list_filter = ("status",)
    search_fields = ("user__email",)
    readonly_fields = (
        "user", "challenge_code", "created_at", "reviewed_at", "reviewed_by", "documents",
    )
    exclude = ("id_document", "selfie", "consent_video")
    actions = ("approve", "reject")

    @admin.display(description="Documentos (descifra y audita)")
    def documents(self, obj):
        # Las URLs viven bajo /api/v1/ (namespace "api") → "api:verification:document".
        id_url = reverse("api:verification:document", args=[obj.pk, "id_document"])
        selfie_url = reverse("api:verification:document", args=[obj.pk, "selfie"])
        links = [
            ("Cédula", id_url),
            ("Selfie", selfie_url),
        ]
        if obj.consent_video:
            video_url = reverse("api:verification:document", args=[obj.pk, "consent_video"])
            links.append(("Video", video_url))
        return format_html(
            " · ".join('<a href="{}" target="_blank">{}</a>' for _ in links),
            *[item for pair in links for item in (pair[1], pair[0])],
        )

    def save_model(self, request, obj, form, change):
        """Cualquier cambio de status disparado desde el formulario sincroniza
        el ModelProfile (avanza o revoca según corresponda) + notifica.
        """
        # Status anterior antes del save.
        previous_status = None
        if change and obj.pk:
            original = VerificationRequest.objects.filter(pk=obj.pk).first()
            if original:
                previous_status = original.status
        new_status = obj.status

        # No permitir aprobar sin video de consentimiento (requisito legal).
        if (
            new_status == VerificationRequest.Status.VERIFIED
            and previous_status != VerificationRequest.Status.VERIFIED
            and not obj.consent_video
        ):
            obj.status = previous_status or VerificationRequest.Status.PENDING
            super().save_model(request, obj, form, change)
            messages.error(
                request,
                f"No se puede aprobar: la solicitud #{obj.id} no incluye video de "
                "consentimiento. Pídele al usuario que re-envíe el KYC.",
            )
            return

        # Setear reviewed_by/at si la VR está cambiando a un estado terminal
        # por primera vez (verified/rejected) y no había sido revisada antes.
        if (
            new_status in (VerificationRequest.Status.VERIFIED, VerificationRequest.Status.REJECTED)
            and obj.reviewed_at is None
        ):
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()

        super().save_model(request, obj, form, change)

        # No hacemos nada si el status no cambió.
        if previous_status == new_status:
            return

        # Transición verified → no verified: revocar perfil (limpia verified_at).
        if previous_status == VerificationRequest.Status.VERIFIED:
            profile_status = (
                ModelProfile.VerificationStatus.REJECTED
                if new_status == VerificationRequest.Status.REJECTED
                else ModelProfile.VerificationStatus.PENDING
            )
            self._set_profile_status(obj.user, profile_status)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="Verificación revertida",
                message=(
                    "Tu verificación fue puesta en revisión nuevamente. Tu perfil ya "
                    "no aparece públicamente hasta que se apruebe de nuevo."
                ),
                link="/dashboard",
            )
            return

        # Transición pending/null → verified.
        if new_status == VerificationRequest.Status.VERIFIED:
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.VERIFIED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="✅ Verificación aprobada",
                message="Tu identidad fue verificada. Trial gratuito activo.",
                link="/dashboard",
            )
            return

        # Transición pending → rejected.
        if new_status == VerificationRequest.Status.REJECTED:
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.REJECTED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="Verificación rechazada",
                message=obj.rejection_reason or "Revisa los documentos y vuelve a intentarlo.",
                link="/dashboard",
            )

    def _set_profile_status(self, user, status):
        """Sincroniza el ModelProfile. Maneja:
        - Primera aprobación: setea verified_at (ancla del trial).
        - Re-aprobación: deja verified_at intacto (anti-abuso del trial).
        - Revocación (verified → pending/rejected): LIMPIA verified_at.
          Esto es lo que quita la visibilidad pública inmediatamente.
        """
        profile = ModelProfile.objects.filter(user=user).first()
        if not profile:
            return
        profile.verification_status = status
        fields = ["verification_status"]
        if status == ModelProfile.VerificationStatus.VERIFIED:
            if profile.verified_at is None:
                profile.verified_at = timezone.now()
                fields.append("verified_at")
        else:
            # Revocación: si el perfil tenía verified_at, lo limpiamos para
            # que el filtro de visibilidad pública lo deje de mostrar.
            if profile.verified_at is not None:
                profile.verified_at = None
                fields.append("verified_at")
        profile.save(update_fields=fields)

    @admin.action(description="Aprobar verificación (marca perfil como verificado)")
    def approve(self, request, queryset):
        approved = skipped = 0
        for obj in queryset:
            if not obj.consent_video:
                self.message_user(
                    request,
                    f"VR #{obj.id} ({obj.user.email}): SIN video de consentimiento — "
                    "no se aprobó. Pide al usuario re-enviar.",
                    level=messages.ERROR,
                )
                skipped += 1
                continue
            obj.status = VerificationRequest.Status.VERIFIED
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save()
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.VERIFIED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="✅ Verificación aprobada",
                message="Tu identidad fue verificada. Ahora puedes publicar tus anuncios.",
                link="/dashboard",
            )
            approved += 1
        self.message_user(
            request,
            f"{approved} aprobada(s)" + (f", {skipped} omitida(s) sin video." if skipped else "."),
        )

    @admin.action(description="Rechazar verificación")
    def reject(self, request, queryset):
        for obj in queryset:
            obj.status = VerificationRequest.Status.REJECTED
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save()
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.REJECTED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="Verificación rechazada",
                message="Revisa los documentos enviados y vuelve a intentarlo desde el dashboard.",
                link="/dashboard",
            )
        self.message_user(request, f"{queryset.count()} verificación(es) rechazada(s).")


@admin.register(VerificationAccessLog)
class VerificationAccessLogAdmin(admin.ModelAdmin):
    list_display = ("request", "accessed_by", "field_name", "accessed_at", "ip_address")
    list_filter = ("field_name",)
    readonly_fields = ("request", "accessed_by", "field_name", "accessed_at", "ip_address")

    def has_add_permission(self, request):
        return False
