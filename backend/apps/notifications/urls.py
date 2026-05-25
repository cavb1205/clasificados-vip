from django.urls import path

from . import views

app_name = "notifications"

urlpatterns = [
    path("me/notifications/", views.NotificationListView.as_view(), name="list"),
    path("me/notifications/unread-count/", views.UnreadCountView.as_view(), name="unread-count"),
    path("me/notifications/mark-all-read/", views.MarkAllReadView.as_view(), name="mark-all-read"),
]
