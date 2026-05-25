from django.contrib import admin

from apps.notifications.models import Notification, notify_user
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
        # Iteramos para poder notificar al perfil dueño en cada caso.
        count = 0
        for review in queryset.exclude(status=Review.Status.APPROVED):
            review.status = Review.Status.APPROVED
            review.save(update_fields=["status"])
            notify_user(
                review.profile.user, kind=Notification.Kind.REVIEW,
                title=f"⭐ Nueva reseña de {review.rating}",
                message=review.comment or "Recibiste una reseña aprobada.",
                link=f"/perfil/{review.profile.slug}",
            )
            count += 1
        self.message_user(request, f"{count} reseña(s) aprobada(s).")

    @admin.action(description="Rechazar reseñas seleccionadas")
    def reject(self, request, queryset):
        updated = queryset.update(status=Review.Status.REJECTED)
        self.message_user(request, f"{updated} reseña(s) rechazada(s).")
