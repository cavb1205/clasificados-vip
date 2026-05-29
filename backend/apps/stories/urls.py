from django.urls import path

from . import views

app_name = "stories"

urlpatterns = [
    path("me/stories/", views.MyStoriesView.as_view(), name="my-list"),
    path("me/stories/<int:pk>/", views.MyStoryDeleteView.as_view(), name="my-delete"),
    path("profiles/<slug:slug>/stories/", views.ProfileStoriesView.as_view(), name="public-list"),
    path("stories/<int:pk>/report/", views.StoryReportView.as_view(), name="report"),
]
