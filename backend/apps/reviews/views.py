from django.db.models import Avg, Count
from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsClient
from .models import Review
from .serializers import PublicReviewSerializer, ReviewSerializer


class CreateReviewView(generics.CreateAPIView):
    """Un cliente (con email verificado) deja una reseña. Queda pendiente de moderación."""

    serializer_class = ReviewSerializer
    permission_classes = [permissions.IsAuthenticated, IsClient]


class ProfileReviewsView(generics.ListAPIView):
    """Reseñas APROBADAS de un perfil (público)."""

    serializer_class = PublicReviewSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        return Review.objects.filter(
            profile__slug=self.kwargs["slug"], status=Review.Status.APPROVED
        ).select_related("client")


class ProfileRatingView(APIView):
    """Rating agregado (promedio + total) de reseñas aprobadas. Útil para SEO."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        agg = Review.objects.filter(
            profile__slug=slug, status=Review.Status.APPROVED
        ).aggregate(average=Avg("rating"), count=Count("id"))
        return Response(
            {
                "average": round(agg["average"], 2) if agg["average"] else None,
                "count": agg["count"],
            }
        )
