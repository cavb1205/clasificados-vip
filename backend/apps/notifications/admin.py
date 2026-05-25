from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("recipient", "kind", "title", "created_at", "read_at")
    list_filter = ("kind", "read_at")
    search_fields = ("recipient__email", "title")
    readonly_fields = ("recipient", "kind", "title", "message", "link", "created_at", "read_at")
