from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "profiles"

router = DefaultRouter()
router.register("me/profile", views.MyProfileViewSet, basename="my-profile")

urlpatterns = [
    path("regions/", views.RegionListView.as_view(), name="regions"),
    path("cities/", views.CityListView.as_view(), name="cities"),
    path("profiles/", views.PublicProfileListView.as_view(), name="public-list"),
    path("profiles/<slug:slug>/", views.PublicProfileDetailView.as_view(), name="public-detail"),
] + router.urls
