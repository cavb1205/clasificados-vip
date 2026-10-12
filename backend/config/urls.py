"""URL configuration para clasificados_vip."""
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.urls import include, path, re_path

api_v1 = [
    path("auth/", include("apps.users.urls")),
    path("", include("apps.profiles.urls")),
    path("", include("apps.verification.urls")),
    path("", include("apps.media_content.urls")),
    path("", include("apps.publications.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.notifications.urls")),
    path("", include("apps.stories.urls")),
    path("", include("apps.rooms.urls")),
    path("", include("apps.audit.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"))),
    # Healthcheck para Docker / Traefik (responde si la app está viva).
    path("healthz/", lambda r: JsonResponse({"status": "ok"})),
]

# Todos los modelos de archivos usan storage privado y endpoints con permisos.
# Cierra también el acceso a copias históricas de comprobantes/fotos/stories
# que aún puedan existir en el volumen público antes de la migración.
def _blocked_legacy_media(request, path=""):
    """Impide el bypass de archivos históricos aún no migrados."""
    return HttpResponse(status=404)


urlpatterns += [
    re_path(r"^media/(?P<path>.*)$", _blocked_legacy_media),
]
