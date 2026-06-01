from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "profiles"

router = DefaultRouter()
router.register("me/profile", views.MyProfileViewSet, basename="my-profile")

urlpatterns = [
    path("regions/", views.RegionListView.as_view(), name="regions"),
    path("cities/", views.CityListView.as_view(), name="cities"),
    path("services/", views.ServiceListView.as_view(), name="services"),
    path("profiles/", views.PublicProfileListView.as_view(), name="public-list"),
    path("me/favorites/", views.MyFavoritesListView.as_view(), name="my-favorites"),
    path("profiles/<slug:slug>/", views.PublicProfileDetailView.as_view(), name="public-detail"),
    path("profiles/<slug:slug>/events/", views.LogProfileEventView.as_view(), name="log-event"),
    path("profiles/<slug:slug>/favorite/", views.FavoriteToggleView.as_view(), name="favorite-toggle"),
    path("profiles/<slug:slug>/report/", views.ProfileReportView.as_view(), name="report"),
    path("admin/profile-reports/", views.AdminProfileReportQueueView.as_view(), name="admin-profile-reports"),
    path(
        "admin/profile-reports/<int:pk>/action/",
        views.AdminProfileReportActionView.as_view(),
        name="admin-profile-report-action",
    ),
    path("me/profile/stats/", views.MyProfileStatsView.as_view(), name="my-profile-stats"),
    path("admin/profiles/", views.AdminModelProfileListView.as_view(), name="admin-profiles"),
    path(
        "admin/profiles/<int:pk>/action/",
        views.AdminModelProfileActionView.as_view(),
        name="admin-profile-action",
    ),
] + router.urls
