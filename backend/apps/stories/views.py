"""Endpoints de Stories: subir, listar propio, listar público, eliminar, reportar."""

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.models import ModelProfile
from apps.publications.models import Publication
from core.image_processing import process_image
from core.permissions import IsModel, IsModerator

from .models import MAX_STORIES_ALIVE, Story, StoryReport
from .serializers import StorySerializer

MAX_PHOTO_BYTES = 15 * 1024 * 1024   # 15 MB
MAX_VIDEO_BYTES = 50 * 1024 * 1024   # 50 MB


def _is_eligible(profile: ModelProfile) -> bool:
    """Solo verificadas con publicación activa destacada pueden subir stories."""
    if not profile or not profile.is_verified:
        return False
    return Publication.objects.filter(
        profile=profile,
        status=Publication.Status.ACTIVE,
        is_featured=True,
        expires_at__gt=timezone.now(),
    ).exists()


def _live_stories(profile: ModelProfile):
    return Story.objects.filter(profile=profile, expires_at__gt=timezone.now())


class MyStoriesView(generics.ListCreateAPIView):
    """La modelo lista y sube sus stories vivas."""

    serializer_class = StorySerializer
    permission_classes = [permissions.IsAuthenticated, IsModel]

    def get_queryset(self):
        return _live_stories(
            ModelProfile.objects.filter(user=self.request.user).first()
        ).order_by("-created_at")

    def post(self, request):
        profile = ModelProfile.objects.filter(user=request.user).first()
        if not _is_eligible(profile):
            return Response(
                {"detail": "Las stories están disponibles solo para perfiles "
                           "verificados con anuncio destacado activo."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Tope simultáneo: si llega al máximo, expirar la más vieja para
        # liberar el slot.
        live = _live_stories(profile).order_by("created_at")
        if live.count() >= MAX_STORIES_ALIVE:
            oldest = live.first()
            oldest.file.delete(save=False)
            oldest.delete()

        upload = request.FILES.get("upload")
        if not upload:
            return Response({"detail": "Falta el archivo."}, status=400)

        kind = "video" if (upload.content_type or "").startswith("video/") else "photo"
        max_bytes = MAX_VIDEO_BYTES if kind == "video" else MAX_PHOTO_BYTES
        if upload.size > max_bytes:
            mb = max_bytes // (1024 * 1024)
            return Response(
                {"detail": f"Archivo muy grande (máx {mb} MB)."},
                status=400,
            )

        story = Story(profile=profile, kind=kind)
        if kind == "photo":
            # Pipeline: strip EXIF/GPS + watermark + JPEG optimizado.
            processed = process_image(upload.read(), filename_stem="story")
            story.file.save(processed.name, processed, save=False)
        else:
            story.file = upload
        story.save()
        return Response(
            StorySerializer(story, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class MyStoryDeleteView(generics.DestroyAPIView):
    """La modelo elimina una story propia antes de que expire."""

    permission_classes = [permissions.IsAuthenticated, IsModel]

    def get_queryset(self):
        return Story.objects.filter(profile__user=self.request.user)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()


class ProfileStoriesView(generics.ListAPIView):
    """Lista pública de stories vivas de un perfil (visible para cualquiera)."""

    serializer_class = StorySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None

    def get_queryset(self):
        profile = get_object_or_404(
            ModelProfile,
            slug=self.kwargs["slug"],
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )
        return _live_stories(profile).order_by("created_at")


class StoryReportView(APIView):
    """Cualquiera (sin login) puede reportar una story como problemática."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        story = get_object_or_404(Story, pk=pk, expires_at__gt=timezone.now())
        reason = (request.data.get("reason") or "")[:200].strip()
        StoryReport.objects.create(story=story, reason=reason)
        return Response({"detail": "Gracias por el reporte."}, status=status.HTTP_201_CREATED)


# ─── Admin endpoints ────────────────────────────────────────────────────────
from rest_framework import generics  # noqa: E402
from rest_framework import serializers as drf_serializers  # noqa: E402


class AdminStoryReportSerializer(drf_serializers.ModelSerializer):
    story_id = drf_serializers.IntegerField(source="story.id", read_only=True)
    kind = drf_serializers.CharField(source="story.kind", read_only=True)
    file_url = drf_serializers.SerializerMethodField()
    stage_name = drf_serializers.CharField(
        source="story.profile.stage_name", read_only=True
    )
    profile_slug = drf_serializers.CharField(
        source="story.profile.slug", read_only=True
    )
    story_expires_at = drf_serializers.DateTimeField(
        source="story.expires_at", read_only=True
    )

    class Meta:
        model = StoryReport
        fields = [
            "id", "story_id", "kind", "file_url", "stage_name",
            "profile_slug", "reason", "created_at", "story_expires_at",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if not obj.story.file:
            return None
        url = obj.story.file.url
        return request.build_absolute_uri(url) if request else url


class AdminStoryReportQueueView(generics.ListAPIView):
    serializer_class = AdminStoryReportSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return StoryReport.objects.select_related(
            "story", "story__profile"
        ).order_by("-created_at")


class AdminStoryReportActionView(generics.GenericAPIView):
    """POST {action: 'delete_story' | 'dismiss'}."""

    permission_classes = [IsModerator]
    queryset = StoryReport.objects.all()

    def post(self, request, pk):
        report = self.get_object()
        action_kind = (request.data.get("action") or "").lower()
        if action_kind == "delete_story":
            story = report.story
            try:
                story.file.delete(save=False)
            except Exception:
                pass
            story.delete()  # cascade borra el resto de reports asociados
            return Response({"detail": "Story eliminada."})
        if action_kind == "dismiss":
            report.delete()
            return Response({"detail": "Reporte descartado."})
        return Response({"detail": "action debe ser delete_story|dismiss"}, status=400)
