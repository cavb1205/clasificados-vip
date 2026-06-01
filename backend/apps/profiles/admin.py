from django.contrib import admin

from .models import (
    City, Favorite, ModelProfile, ProfileReport, Region, Service, SiteConfig,
)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "order")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(City)
class CityAdmin(admin.ModelAdmin):
    list_display = ("name", "region")
    list_filter = ("region",)
    search_fields = ("name",)
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "order")
    list_filter = ("category",)
    list_editable = ("category", "order")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(ModelProfile)
class ModelProfileAdmin(admin.ModelAdmin):
    list_display = ("stage_name", "user", "city", "verification_status", "created_at")
    list_filter = ("verification_status", "city__region")
    search_fields = ("stage_name", "user__email")
    readonly_fields = ("slug", "created_at", "updated_at")


@admin.register(SiteConfig)
class SiteConfigAdmin(admin.ModelAdmin):
    """Editor del singleton de configuración. No se puede agregar ni borrar."""

    list_display = ("__str__", "trial_days", "max_active_rooms_per_host")
    fields = ("trial_days", "max_active_rooms_per_host")

    def has_add_permission(self, request):
        # Sólo permitir "agregar" si todavía no hay registro.
        return not SiteConfig.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ("user", "profile", "created_at")
    search_fields = ("user__email", "profile__stage_name")


@admin.register(ProfileReport)
class ProfileReportAdmin(admin.ModelAdmin):
    list_display = ("profile", "reporter", "reason", "created_at")
