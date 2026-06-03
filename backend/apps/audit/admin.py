from django.contrib import admin

from .models import AdminActionLog


@admin.register(AdminActionLog)
class AdminActionLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "action", "target", "note")
    list_filter = ("action",)
    search_fields = ("actor__email", "target", "note")
    readonly_fields = ("actor", "action", "target", "note", "created_at")

    def has_add_permission(self, request):
        return False
