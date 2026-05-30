from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "publications"

router = DefaultRouter()
router.register("me/publications", views.MyPublicationViewSet, basename="my-publications")

urlpatterns = [
    path("plans/", views.PlanListView.as_view(), name="plans"),
    path("publications/", views.PublicPublicationListView.as_view(), name="public-list"),
    path("admin/stats/", views.AdminStatsView.as_view(), name="admin-stats"),
    path(
        "admin/payments/",
        views.AdminPaymentQueueView.as_view(),
        name="admin-payments",
    ),
    path(
        "admin/payments/<int:pk>/action/",
        views.AdminPaymentActionView.as_view(),
        name="admin-payment-action",
    ),
    path(
        "admin/publications/<int:pk>/expire/",
        views.AdminExpirePublicationView.as_view(),
        name="admin-publication-expire",
    ),
    path("admin/plans/", views.AdminPlanListCreateView.as_view(), name="admin-plans"),
    path(
        "admin/plans/<int:pk>/",
        views.AdminPlanDetailView.as_view(),
        name="admin-plan-detail",
    ),
    path(
        "admin/site-config/",
        views.AdminSiteConfigView.as_view(),
        name="admin-site-config",
    ),
] + router.urls
