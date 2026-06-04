from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "media_content"

router = DefaultRouter()
router.register("me/media", views.MyMediaViewSet, basename="my-media")

urlpatterns = [
    path("admin/media/<int:pk>/hide/", views.AdminMediaHideView.as_view(), name="admin-media-hide"),
] + router.urls
