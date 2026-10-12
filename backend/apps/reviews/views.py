from django.db.models import Avg, Count
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.models import ModelProfile
from core.permissions import IsClient, IsModel, IsModerator
from core.request_validation import request_text
from apps.audit.models import log_action
from .models import Review
from .serializers import (
    MyProfileReviewSerializer,
    MyReviewSerializer,
    PublicReviewSerializer,
    ReviewSerializer,
)


class CreateReviewView(generics.CreateAPIView):
    """Un cliente deja una reseña. Queda pendiente de moderación."""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsClient]


class MyReviewsView(generics.ListAPIView):
    """Reseñas que dejó el usuario logueado (con su estado de moderación)."""

    serializer_class = MyReviewSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return (
            Review.objects.filter(client=self.request.user)
            .select_related("profile")
            .order_by("-created_at")
        )


class ProfileReviewsView(generics.ListAPIView):
    """Reseñas APROBADAS de un perfil (público)."""

    serializer_class = PublicReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        profile = get_object_or_404(ModelProfile.objects.publicly_visible(), slug=self.kwargs["slug"])
        return Review.objects.filter(
            profile=profile, status=Review.Status.APPROVED
        ).select_related("client")


class ProfileRatingView(APIView):
    """Rating agregado (promedio + total) de reseñas aprobadas. Útil para SEO."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        profile = get_object_or_404(ModelProfile.objects.publicly_visible(), slug=slug)
        agg = Review.objects.filter(
            profile=profile, status=Review.Status.APPROVED
        ).aggregate(average=Avg("rating"), count=Count("id"))
        return Response(
            {
                "average": round(agg["average"], 2) if agg["average"] else None,
                "count": agg["count"],
            }
        )


def _my_profile(user):
    return ModelProfile.objects.filter(user=user).first()


class MyProfileReviewsView(generics.ListAPIView):
    """Reseñas APROBADAS que recibió la modelo logueada."""

    serializer_class = MyProfileReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]
    pagination_class = None

    def get_queryset(self):
        return Review.objects.filter(
            profile__user=self.request.user, status=Review.Status.APPROVED
        ).select_related("client").order_by("-created_at")


class MyReviewReplyView(APIView):
    """La modelo responde públicamente una reseña suya (aprobada)."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def post(self, request, pk):
        review = Review.objects.filter(
            pk=pk, profile__user=request.user, status=Review.Status.APPROVED
        ).first()
        if not review:
            return Response({"detail": "Reseña no encontrada."}, status=404)
        review.reply = request_text(request.data, "reply", max_length=1000)
        review.save(update_fields=["reply"])
        return Response(MyProfileReviewSerializer(review).data)


class MyReviewReportView(APIView):
    """La modelo reporta una reseña como falsa/abusiva para revisión admin."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def post(self, request, pk):
        review = Review.objects.filter(pk=pk, profile__user=request.user).first()
        if not review:
            return Response({"detail": "Reseña no encontrada."}, status=404)
        review.is_flagged = True
        review.flag_reason = request_text(request.data, "reason", max_length=300)
        review.save(update_fields=["is_flagged", "flag_reason"])
        return Response({"id": review.id, "is_flagged": True})


# ─── Admin endpoints ────────────────────────────────────────────────────────
from rest_framework import generics, permissions, serializers as drf_serializers  # noqa: E402

from apps.notifications.models import Notification, notify_user  # noqa: E402


class AdminReviewSerializer(drf_serializers.ModelSerializer):
    stage_name = drf_serializers.CharField(source="profile.stage_name", read_only=True)
    profile_slug = drf_serializers.CharField(source="profile.slug", read_only=True)
    client_email = drf_serializers.CharField(source="client.email", read_only=True)
    client_username = drf_serializers.CharField(source="client.username", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id", "stage_name", "profile_slug", "client_email",
            "client_username", "rating", "comment", "reply", "status",
            "is_flagged", "flag_reason", "created_at",
        ]


class AdminReviewQueueView(generics.ListAPIView):
    serializer_class = AdminReviewSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        qs = Review.objects.select_related("profile", "client")
        s = self.request.query_params.get("status", "pending")
        if s == "flagged":
            return qs.filter(is_flagged=True)
        if s in {"pending", "approved", "rejected"}:
            qs = qs.filter(status=s)
        return qs


class AdminReviewActionView(generics.GenericAPIView):
    permission_classes = [IsModerator]
    queryset = Review.objects.all()

    @transaction.atomic
    def post(self, request, pk):
        review = get_object_or_404(Review.objects.select_for_update(), pk=pk)
        action = request_text(request.data, "action", max_length=30).lower()
        if action == "approve":
            if review.status == Review.Status.APPROVED:
                return Response(AdminReviewSerializer(review).data)
            review.status = Review.Status.APPROVED
            review.save(update_fields=["status"])
            notify_user(
                review.profile.user, kind=Notification.Kind.REVIEW,
                title=f"⭐ Nueva reseña de {review.rating}",
                message=review.comment or "Recibiste una reseña aprobada.",
                link=f"/perfil/{review.profile.slug}",
            )
        elif action == "reject":
            review.status = Review.Status.REJECTED
            review.is_flagged = False
            review.save(update_fields=["status", "is_flagged"])
        elif action == "unflag":
            review.is_flagged = False
            review.save(update_fields=["is_flagged"])
        else:
            return Response({"detail": "action debe ser approve|reject|unflag"}, status=400)
        log_action(request.user, f"review.{action}", target=f"Reseña #{review.pk} · {review.profile.stage_name}")
        return Response(AdminReviewSerializer(review).data)
