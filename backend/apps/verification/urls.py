from django.urls import path

from . import views

app_name = "verification"

urlpatterns = [
    path("verification/challenge/", views.IssueChallengeView.as_view(), name="challenge"),
    path("verification/submit/", views.SubmitVerificationView.as_view(), name="submit"),
    path(
        "verification/<int:pk>/document/<str:field>/",
        views.KYCDocumentView.as_view(),
        name="document",
    ),
    # Endpoints del panel staff
    path("admin/kyc/queue/", views.AdminKYCQueueView.as_view(), name="admin-kyc-queue"),
    path("admin/kyc/<int:pk>/action/", views.AdminKYCActionView.as_view(), name="admin-kyc-action"),
    path("admin/kyc/audit/", views.AdminKYCAuditView.as_view(), name="admin-kyc-audit"),
]
