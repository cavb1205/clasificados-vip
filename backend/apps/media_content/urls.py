from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "media_content"

router = DefaultRouter()
router.register("me/media", views.MyMediaViewSet, basename="my-media")

urlpatterns = [
    path("profile-media/<int:pk>/file/", views.PublicMediaFileView.as_view(), name="public-file"),
    path("me/media/<int:pk>/file/", views.MyMediaFileView.as_view(), name="my-file"),
    path("admin/media/<int:pk>/file/", views.AdminMediaFileView.as_view(), name="admin-file"),
    path("admin/media/<int:pk>/hide/", views.AdminMediaHideView.as_view(), name="admin-media-hide"),
] + router.urls
