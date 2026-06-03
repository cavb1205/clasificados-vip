"""URL configuration para clasificados_vip."""
from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve

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

# Servimos /media/ desde Django también en producción. Django.conf.urls.static
# es no-op cuando DEBUG=False, así que montamos el handler manualmente con
# re_path + serve. Para baja escala es correcto (gunicorn sirve archivos de
# pocos MB sin problema). Cuando migremos a S3/R2 el storage devolverá URLs
# absolutas del bucket y esto se puede retirar.
urlpatterns += [
    re_path(
        r"^media/(?P<path>.*)$",
        static_serve,
        {"document_root": settings.MEDIA_ROOT},
    ),
]
