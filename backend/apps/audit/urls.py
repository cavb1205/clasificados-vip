from django.urls import path

from . import views

app_name = "audit"

urlpatterns = [
    path("admin/action-log/", views.AdminActionLogView.as_view(), name="admin-action-log"),
]
