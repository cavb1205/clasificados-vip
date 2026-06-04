from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

app_name = "rooms"

router = DefaultRouter()
router.register("me/rooms", views.MyRoomViewSet, basename="my-rooms")
router.register("me/room-photos", views.MyRoomPhotoViewSet, basename="my-room-photos")

urlpatterns = [
    path("room-plans/", views.RoomPlanListView.as_view(), name="room-plans"),
    path("me/host-profile/", views.MyHostProfileView.as_view(), name="my-host-profile"),
    path(
        "me/room-subscription/",
        views.MyRoomSubscriptionView.as_view(),
        name="my-room-subscription",
    ),
    # Navegación para modelos activas.
    path("room-cities/", views.RoomCitiesView.as_view(), name="room-cities"),
    path("rooms/", views.PublicRoomListView.as_view(), name="public-list"),
    path("rooms/<int:pk>/", views.PublicRoomDetailView.as_view(), name="public-detail"),
    path("rooms/<int:pk>/report/", views.RoomReportView.as_view(), name="report"),
    # Servir fotos tras el gate.
    path(
        "room-photos/<int:pk>/file/",
        views.RoomPhotoFileView.as_view(),
        name="room-photo-file",
    ),
    # Admin / moderación.
    path("admin/room-payments/", views.AdminRoomPaymentQueueView.as_view(), name="admin-room-payments"),
    path(
        "admin/room-payments/<int:pk>/action/",
        views.AdminRoomPaymentActionView.as_view(),
        name="admin-room-payment-action",
    ),
    path("admin/rooms/", views.AdminRoomListView.as_view(), name="admin-rooms"),
    path("admin/rooms/<int:pk>/action/", views.AdminRoomActionView.as_view(), name="admin-room-action"),
    path("admin/hosts/", views.AdminHostListView.as_view(), name="admin-hosts"),
    path("admin/hosts/<int:pk>/action/", views.AdminHostActionView.as_view(), name="admin-host-action"),
    path("admin/room-reports/", views.AdminRoomReportQueueView.as_view(), name="admin-room-reports"),
    path(
        "admin/room-reports/<int:pk>/action/",
        views.AdminRoomReportActionView.as_view(),
        name="admin-room-report-action",
    ),
] + router.urls
