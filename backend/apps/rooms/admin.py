from django.contrib import admin

from .models import HostProfile, RoomListing, RoomPhoto, RoomReceipt


class RoomPhotoInline(admin.TabularInline):
    model = RoomPhoto
    extra = 0


@admin.register(HostProfile)
class HostProfileAdmin(admin.ModelAdmin):
    list_display = ("display_name", "user", "phone", "whatsapp", "created_at")
    search_fields = ("display_name", "user__email", "phone", "whatsapp")


@admin.register(RoomListing)
class RoomListingAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "city", "price", "price_period", "status",
                    "is_paused", "is_suspended", "expires_at")
    list_filter = ("status", "price_period", "is_paused", "is_suspended")
    search_fields = ("title", "owner__display_name", "city__name")
    inlines = [RoomPhotoInline]


@admin.register(RoomReceipt)
class RoomReceiptAdmin(admin.ModelAdmin):
    list_display = ("__str__", "listing", "amount", "status", "created_at", "reviewed_at")
    list_filter = ("status",)
