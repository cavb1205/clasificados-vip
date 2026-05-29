from django.contrib import admin

from .models import Story, StoryReport


@admin.register(Story)
class StoryAdmin(admin.ModelAdmin):
    list_display = ("profile", "kind", "created_at", "expires_at", "reports_count")
    list_filter = ("kind",)
    search_fields = ("profile__stage_name", "profile__user__email")
    readonly_fields = ("profile", "kind", "file", "created_at", "expires_at")
    actions = ("delete_now",)

    def reports_count(self, obj):
        return obj.reports.count()

    @admin.action(description="Eliminar story y archivo")
    def delete_now(self, request, queryset):
        n = 0
        for s in queryset:
            s.file.delete(save=False)
            s.delete()
            n += 1
        self.message_user(request, f"{n} story(s) eliminada(s).")


@admin.register(StoryReport)
class StoryReportAdmin(admin.ModelAdmin):
    list_display = ("story", "reason", "created_at")
    search_fields = ("story__profile__stage_name", "reason")
    readonly_fields = ("story", "reason", "created_at")
