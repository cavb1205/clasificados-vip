"""URL configuration para clasificados_vip."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

api_v1 = [
    path("auth/", include("apps.users.urls")),
    path("", include("apps.profiles.urls")),
    path("", include("apps.verification.urls")),
    path("", include("apps.media_content.urls")),
    path("", include("apps.publications.urls")),
    path("", include("apps.reviews.urls")),
    path("", include("apps.notifications.urls")),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/", include((api_v1, "api"))),
    # Healthcheck para Docker / Traefik (responde si la app está viva).
    path("healthz/", lambda r: JsonResponse({"status": "ok"})),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
