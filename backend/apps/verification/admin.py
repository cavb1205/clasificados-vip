from django.contrib import admin
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html

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
        id_url = reverse("verification:document", args=[obj.pk, "id_document"])
        selfie_url = reverse("verification:document", args=[obj.pk, "selfie"])
        return format_html(
            '<a href="{}" target="_blank">Cédula</a> · <a href="{}" target="_blank">Selfie</a>',
            id_url,
            selfie_url,
        )

    def _set_profile_status(self, user, status):
        profile = ModelProfile.objects.filter(user=user).first()
        if profile:
            profile.verification_status = status
            profile.save(update_fields=["verification_status"])

    @admin.action(description="Aprobar verificación (marca perfil como verificado)")
    def approve(self, request, queryset):
        for obj in queryset:
            obj.status = VerificationRequest.Status.VERIFIED
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save()
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.VERIFIED)
        self.message_user(request, f"{queryset.count()} verificación(es) aprobada(s).")

    @admin.action(description="Rechazar verificación")
    def reject(self, request, queryset):
        for obj in queryset:
            obj.status = VerificationRequest.Status.REJECTED
            obj.reviewed_by = request.user
            obj.reviewed_at = timezone.now()
            obj.save()
            self._set_profile_status(obj.user, ModelProfile.VerificationStatus.REJECTED)
        self.message_user(request, f"{queryset.count()} verificación(es) rechazada(s).")


@admin.register(VerificationAccessLog)
class VerificationAccessLogAdmin(admin.ModelAdmin):
    list_display = ("request", "accessed_by", "field_name", "accessed_at", "ip_address")
    list_filter = ("field_name",)
    readonly_fields = ("request", "accessed_by", "field_name", "accessed_at", "ip_address")

    def has_add_permission(self, request):
        return False
