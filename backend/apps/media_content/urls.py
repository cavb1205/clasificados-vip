from rest_framework.routers import DefaultRouter

from . import views

app_name = "media_content"

router = DefaultRouter()
router.register("me/media", views.MyMediaViewSet, basename="my-media")

urlpatterns = router.urls
