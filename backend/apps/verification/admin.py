from django.contrib import admin
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
    readonly_fields = ("user", "created_at", "reviewed_at", "reviewed_by", "documents")
    exclude = ("id_document", "selfie")
    actions = ("approve", "reject")

    @admin.display(description="Documentos (descifra y audita)")
    def documents(self, obj):
        # Las URLs viven bajo /api/v1/ (namespace "api") → "api:verification:document".
        id_url = reverse("api:verification:document", args=[obj.pk, "id_document"])
        selfie_url = reverse("api:verification:document", args=[obj.pk, "selfie"])
        return format_html(
            '<a href="{}" target="_blank">Cédula</a> · <a href="{}" target="_blank">Selfie</a>',
            id_url,
            selfie_url,
        )

    def save_model(self, request, obj, form, change):
        """Si el admin cambia `status` desde el formulario (no desde la
        acción del menú), igual disparar la lógica de sincronización:
        marca reviewed_by/at, actualiza el perfil y notifica al usuario.

        Sin esto, editar el dropdown a mano deja el sistema inconsistente
        (VerificationRequest verified pero ModelProfile pending).
        """
        new_status = obj.status
        was_unreviewed = obj.reviewed_at is None
        super().save_model(request, obj, form, change)

        if not was_unreviewed:
            return  # ya fue revisada antes, no re-disparar

        if new_status == VerificationRequest.Status.VERIFIED:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save(update_fields=["reviewed_by", "reviewed_at"])
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.VERIFIED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="✅ Verificación aprobada",
                message="Tu identidad fue verificada. Trial gratuito activo.",
                link="/dashboard",
            )
        elif new_status == VerificationRequest.Status.REJECTED:
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save(update_fields=["reviewed_by", "reviewed_at"])
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.REJECTED)
            notify_user(
                obj.user, kind=Notification.Kind.KYC,
                title="Verificación rechazada",
                message="Revisa los documentos enviados y vuelve a intentarlo.",
                link="/dashboard",
            )

    def _set_profile_status(self, user, status):
        profile = ModelProfile.objects.filter(user=user).first()
        if not profile:
            return
        profile.verification_status = status
        fields = ["verification_status"]
        # Anclar el inicio del trial gratuito en la PRIMERA aprobación.
        # Re-aprobaciones posteriores no reinician el trial (anti-abuso).
        if status == ModelProfile.VerificationStatus.VERIFIED and profile.verified_at is None:
            profile.verified_at = timezone.now()
            fields.append("verified_at")
        profile.save(update_fields=fields)

    @admin.action(description="Aprobar verificación (marca perfil como verificado)")
    def approve(self, request, queryset):
        for obj in queryset:
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
        self.message_user(request, f"{queryset.count()} verificación(es) aprobada(s).")

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
