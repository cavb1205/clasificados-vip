from django.contrib import admin

from .models import PaymentReceipt, Publication, SubscriptionPlan


@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "duration_days", "price", "includes_featured", "is_active", "order")
    list_filter = ("is_active", "includes_featured")
    list_editable = ("duration_days", "price", "includes_featured", "is_active", "order")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ("title", "profile", "status", "is_featured", "expires_at")
    list_filter = ("status", "is_featured")
    search_fields = ("title", "profile__stage_name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(PaymentReceipt)
class PaymentReceiptAdmin(admin.ModelAdmin):
    list_display = ("id", "publication", "amount", "status", "created_at", "reviewed_by")
    list_filter = ("status",)
    search_fields = ("publication__title", "publication__profile__stage_name")
    readonly_fields = ("created_at", "reviewed_at", "reviewed_by")
    actions = ("approve_payment", "reject_payment")

    @admin.action(description="Aprobar pago (activa la publicación por 30 días)")
    def approve_payment(self, request, queryset):
        count = 0
        for receipt in queryset.exclude(status=PaymentReceipt.Status.APPROVED):
            receipt.approve(reviewer=request.user)
            count += 1
        self.message_user(request, f"{count} pago(s) aprobado(s) y publicación(es) activada(s).")

    @admin.action(description="Rechazar pago")
    def reject_payment(self, request, queryset):
        for receipt in queryset:
            receipt.reject(reviewer=request.user)
        self.message_user(request, f"{queryset.count()} pago(s) rechazado(s).")
