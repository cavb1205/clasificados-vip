"""Endpoints de Stories: subir, listar propio, listar público, eliminar, reportar."""

import mimetypes

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.urls import reverse
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.profiles.models import ModelProfile
from apps.publications.models import Publication
from core.image_processing import process_image
from core.permissions import IsModel, IsModerator
from core.video_processing import strip_video_metadata, watermark_story_async

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


def _story_file_response(story):
    if not story.file:
        raise Http404
    try:
        stream = story.file.open("rb")
    except (FileNotFoundError, OSError):
        raise Http404
    content_type = mimetypes.guess_type(story.file.name)[0] or "application/octet-stream"
    response = FileResponse(stream, content_type=content_type)
    response["Content-Disposition"] = "inline"
    response["Cache-Control"] = "private, no-store, max-age=0"
    response["X-Content-Type-Options"] = "nosniff"
    response["X-Robots-Tag"] = "noindex, nofollow, noarchive"
    return response


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
            # El video también debe perder metadata/GPS. El watermark requiere
            # re-encode y se ejecuta en segundo plano, igual que MediaContent.
            cleaned = strip_video_metadata(upload)
            story.file.save(cleaned.name, cleaned, save=False)
        story.save()
        if kind == "video":
            watermark_story_async(story.pk)
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
            ModelProfile.objects.publicly_visible(), slug=self.kwargs["slug"]
        )
        return _live_stories(profile).order_by("created_at")


class StoryFileView(APIView):
    """Sirve una story vigente solo si el perfil sigue siendo públicamente visible."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, pk):
        story = get_object_or_404(
            Story.objects.filter(
                profile__in=ModelProfile.objects.publicly_visible(),
                expires_at__gt=timezone.now(),
            ),
            pk=pk,
        )
        return _story_file_response(story)


class CityStoriesView(APIView):
    """Historias activas de las modelos visibles de una comuna.

    Para la franja de historias en la página de ciudad: una entrada por modelo
    con historias vigentes (verificada, no suspendida, en trial o con publicación
    activa). Público.
    """

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        from django.db.models import Prefetch

        now = timezone.now()
        region = request.query_params.get("region")
        city = request.query_params.get("city")
        # Prefetch en 2 queries (historias vivas + media) en vez de N por modelo.
        profiles = (
            ModelProfile.objects.publicly_visible()
            .filter(stories__expires_at__gt=now)
        )
        if city:
            profiles = profiles.filter(city__slug=city)
        if region:
            profiles = profiles.filter(city__region__slug=region)
        profiles = (
            profiles.distinct().select_related("city")
            .prefetch_related(
                Prefetch(
                    "stories",
                    queryset=Story.objects.filter(expires_at__gt=now).order_by("created_at"),
                    to_attr="live_stories",
                ),
                "media",
            )[:60]
        )

        def avatar_fallback(p):
            if getattr(p, "avatar", None):
                return request.build_absolute_uri(p.avatar.url)
            photo = next(
                (m for m in p.media.all() if m.media_type == "photo" and not m.is_hidden),
                None,
            )
            return request.build_absolute_uri(photo.file.url) if photo else None

        out = []
        for p in profiles:
            stories = list(p.live_stories)
            if not stories:
                continue
            # La burbuja muestra la HISTORIA más reciente (no el avatar) para que
            # se distinga el contenido. Si la última es video (sin frame), caemos
            # a la foto-historia más reciente y, si no hay, al avatar.
            latest_photo = next(
                (s for s in reversed(stories) if s.kind == Story.Kind.PHOTO), None
            )
            thumb = (
                StorySerializer(latest_photo, context={"request": request}).data["file_url"]
                if latest_photo else avatar_fallback(p)
            )
            out.append({
                "slug": p.slug,
                "stage_name": p.stage_name,
                "cover_photo": thumb,
                "stories": StorySerializer(stories, many=True, context={"request": request}).data,
            })
        return Response(out)


class StoryReportView(APIView):
    """Cualquiera (sin login) puede reportar una story como problemática."""

    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        story = get_object_or_404(
            Story.objects.filter(
                profile__in=ModelProfile.objects.publicly_visible(),
                expires_at__gt=timezone.now(),
            ),
            pk=pk,
        )
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
        url = reverse("api:stories:admin-file", args=[obj.story.pk])
        return request.build_absolute_uri(url) if request else url


class AdminStoryReportQueueView(generics.ListAPIView):
    serializer_class = AdminStoryReportSerializer
    permission_classes = [IsModerator]

    def get_queryset(self):
        return StoryReport.objects.select_related(
            "story", "story__profile"
        ).order_by("-created_at")


class AdminStoryFileView(generics.GenericAPIView):
    """Sirve stories reportadas solo a moderadores/admins."""

    permission_classes = [IsModerator]
    queryset = Story.objects.all()

    def get(self, request, pk):
        return _story_file_response(self.get_object())


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
