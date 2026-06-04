from django.urls import path

from . import views

app_name = "reviews"

urlpatterns = [
    path("reviews/", views.CreateReviewView.as_view(), name="create"),
    path("me/reviews/", views.MyReviewsView.as_view(), name="my-reviews"),
    path("me/profile/reviews/", views.MyProfileReviewsView.as_view(), name="my-profile-reviews"),
    path("me/profile/reviews/<int:pk>/reply/", views.MyReviewReplyView.as_view(), name="my-review-reply"),
    path("me/profile/reviews/<int:pk>/report/", views.MyReviewReportView.as_view(), name="my-review-report"),
    path("profiles/<slug:slug>/reviews/", views.ProfileReviewsView.as_view(), name="list"),
    path("profiles/<slug:slug>/rating/", views.ProfileRatingView.as_view(), name="rating"),
    path("admin/reviews/", views.AdminReviewQueueView.as_view(), name="admin-list"),
    path(
        "admin/reviews/<int:pk>/action/",
        views.AdminReviewActionView.as_view(),
        name="admin-action",
    ),
]
