from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "publications"

router = DefaultRouter()
router.register("me/publications", views.MyPublicationViewSet, basename="my-publications")

urlpatterns = [
    path("plans/", views.PlanListView.as_view(), name="plans"),
    path("publications/", views.PublicPublicationListView.as_view(), name="public-list"),
] + router.urls
