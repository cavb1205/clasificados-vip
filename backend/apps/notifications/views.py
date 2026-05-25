from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """Lista de notificaciones propias; las no-leídas primero."""

    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None  # son pocas; el dashboard las muestra todas

    def get_queryset(self):
        # Las no-leídas primero, luego por fecha descendente.
        return Notification.objects.filter(recipient=self.request.user).order_by(
            "read_at", "-created_at"
        )


class UnreadCountView(APIView):
    """Solo el conteo de no-leídas — barato para sondear desde el dashboard."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).count()
        return Response({"unread": count})


class MarkAllReadView(APIView):
    """Marca todas las no-leídas del usuario como leídas."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(
            recipient=request.user, read_at__isnull=True
        ).update(read_at=timezone.now())
        return Response({"marked": updated}, status=status.HTTP_200_OK)
