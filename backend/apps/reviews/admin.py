from django.contrib import admin

from .models import Review


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("profile", "client", "rating", "status", "created_at")
    list_filter = ("status", "rating")
    search_fields = ("profile__stage_name", "client__email", "comment")
    readonly_fields = ("profile", "client", "rating", "comment", "created_at")
    actions = ("approve", "reject")

    @admin.action(description="Aprobar reseñas seleccionadas")
    def approve(self, request, queryset):
        updated = queryset.update(status=Review.Status.APPROVED)
        self.message_user(request, f"{updated} reseña(s) aprobada(s).")

    @admin.action(description="Rechazar reseñas seleccionadas")
    def reject(self, request, queryset):
        updated = queryset.update(status=Review.Status.REJECTED)
        self.message_user(request, f"{updated} reseña(s) rechazada(s).")
