from rest_framework import generics, permissions, serializers

from core.pagination import AdminPagination

from .models import AdminActionLog


class AdminActionLogSerializer(serializers.ModelSerializer):
    actor_email = serializers.CharField(source="actor.email", read_only=True, default="(sistema)")

    class Meta:
        model = AdminActionLog
        fields = ["id", "actor_email", "action", "target", "note", "created_at"]


class AdminActionLogView(generics.ListAPIView):
    """Bitácora de acciones del staff (solo admin). Filtros: ?action= &q=."""

    serializer_class = AdminActionLogSerializer
    permission_classes = [permissions.IsAdminUser]
    pagination_class = AdminPagination

    def get_queryset(self):
        qs = AdminActionLog.objects.select_related("actor")
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        q = (self.request.query_params.get("q") or "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(target__icontains=q) | Q(note__icontains=q) | Q(actor__email__icontains=q))
        return qs
