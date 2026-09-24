from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils import timezone

from .models import CustomUser, LegalAcceptance, PrivacyRequest


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):
    list_display = ("email", "username", "role", "email_verified", "is_staff")
    list_filter = ("role", "email_verified", "is_staff", "is_active")
    search_fields = ("email", "username")
    ordering = ("email",)
    fieldsets = UserAdmin.fieldsets + (("Plataforma", {"fields": ("role", "email_verified")}),)


@admin.register(LegalAcceptance)
class LegalAcceptanceAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "terms_version", "privacy_version", "source", "accepted_at")
    list_filter = ("role", "source", "terms_version", "privacy_version")
    search_fields = ("user__email", "user__username")
    readonly_fields = ("user", "role", "terms_version", "privacy_version", "source", "accepted_at")
    ordering = ("-accepted_at",)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(PrivacyRequest)
class PrivacyRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "request_type", "status", "created_at", "handled_by", "handled_at")
    list_filter = ("request_type", "status", "created_at")
    search_fields = ("user__email", "user__username", "details", "resolution_notes")
    readonly_fields = ("user", "request_type", "details", "created_at", "updated_at")
    ordering = ("status", "created_at")

    def save_model(self, request, obj, form, change):
        if obj.status in {PrivacyRequest.Status.COMPLETED, PrivacyRequest.Status.DENIED}:
            obj.handled_by = request.user
            obj.handled_at = timezone.now()
        else:
            obj.handled_by = None
            obj.handled_at = None
        super().save_model(request, obj, form, change)
