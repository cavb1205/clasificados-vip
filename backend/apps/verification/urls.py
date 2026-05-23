from django.urls import path

from . import views

app_name = "verification"

urlpatterns = [
    path("verification/submit/", views.SubmitVerificationView.as_view(), name="submit"),
    path(
        "verification/<int:pk>/document/<str:field>/",
        views.KYCDocumentView.as_view(),
        name="document",
    ),
]
