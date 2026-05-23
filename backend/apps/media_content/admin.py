from django.contrib import admin

from .models import MediaContent


@admin.register(MediaContent)
class MediaContentAdmin(admin.ModelAdmin):
    list_display = ("profile", "media_type", "order", "created_at")
    list_filter = ("media_type",)
    search_fields = ("profile__stage_name",)
