import logging

from django.db import transaction
from django.db.models import Max
from django.urls import reverse
from rest_framework import serializers

from apps.profiles.models import ModelProfile
from core.image_processing import process_image
from core.upload_validation import UploadValidationError, validate_image_upload, validate_video_upload
from core.video_processing import strip_video_metadata, watermark_media_async
from .models import MediaContent, profile_media_limits

logger = logging.getLogger(__name__)


class MediaReorderSerializer(serializers.Serializer):
    ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=100,
    )

    def validate_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("No se permiten IDs repetidos.")
        return value


class MediaContentSerializer(serializers.ModelSerializer):
    upload = serializers.FileField(write_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaContent
        fields = ["id", "media_type", "upload", "file_url", "order", "created_at"]
        read_only_fields = ["file_url", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        url = reverse("api:media_content:my-file", args=[obj.pk])
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        # En PATCH solo se permite reordenar. Cambiar tipo o reemplazar el
        # archivo debe pasar por el flujo de alta, que aplica límites y pipeline.
        if self.partial:
            unexpected = set(attrs) - {"order"}
            if unexpected:
                raise serializers.ValidationError(
                    {field: "Solo se puede modificar el orden." for field in unexpected}
                )
            return attrs

        profile = self.context["profile"]
        media_type = attrs["media_type"]
        max_photos, max_videos = profile_media_limits(profile)
        if media_type == MediaContent.MediaType.PHOTO:
            limit, label = max_photos, "fotos"
        else:
            limit, label = max_videos, "videos"
        count = MediaContent.objects.filter(profile=profile, media_type=media_type).count()
        if count >= limit:
            raise serializers.ValidationError(
                {"upload": f"Límite alcanzado: máximo {limit} {label} por perfil."}
            )
        return attrs

    def validate_upload(self, value):
        media_type = self.initial_data.get("media_type")
        try:
            if media_type == MediaContent.MediaType.PHOTO:
                return validate_image_upload(value)
            return validate_video_upload(value)
        except UploadValidationError as exc:
            raise serializers.ValidationError(str(exc)) from exc

    def create(self, validated_data):
        upload = validated_data.pop("upload")
        profile = self.context["profile"]
        # La posición se controla con el endpoint atómico de reordenamiento.
        validated_data.pop("order", None)
        media = MediaContent(profile=profile, **validated_data)

        if media.media_type == MediaContent.MediaType.PHOTO:
            # Pipeline: strip EXIF/GPS + watermark + compresión JPEG.
            processed = process_image(upload.read(), filename_stem="photo")
        else:
            # Video: quitar metadata/GPS (ffmpeg, rápido) ahora; el watermark
            # (re-encode lento) se aplica en segundo plano para no bloquear.
            try:
                processed = strip_video_metadata(upload)
            except RuntimeError as exc:
                raise serializers.ValidationError({"upload": str(exc)}) from exc

        saved_name = ""
        try:
            with transaction.atomic():
                # Hace que el límite y la posición final sean coherentes ante
                # subidas simultáneas del mismo perfil. El procesado pesado ya
                # ocurrió fuera del lock.
                profile = ModelProfile.objects.select_for_update().get(pk=profile.pk)
                media.profile = profile
                max_photos, max_videos = profile_media_limits(profile)
                limit = (
                    max_photos
                    if media.media_type == MediaContent.MediaType.PHOTO
                    else max_videos
                )
                queryset = MediaContent.objects.filter(
                    profile=profile, media_type=media.media_type
                )
                if queryset.count() >= limit:
                    label = (
                        "fotos"
                        if media.media_type == MediaContent.MediaType.PHOTO
                        else "videos"
                    )
                    raise serializers.ValidationError(
                        {"upload": f"Límite alcanzado: máximo {limit} {label} por perfil."}
                    )

                current_max = queryset.aggregate(value=Max("order"))["value"]
                media.order = 0 if current_max is None else current_max + 10

                media.file.save(processed.name, processed, save=False)
                saved_name = media.file.name
                media.save()
        except Exception:
            if saved_name:
                try:
                    media.file.storage.delete(saved_name)
                except Exception:
                    logger.exception("No se pudo limpiar un archivo de media parcial")
            raise

        if media.media_type == MediaContent.MediaType.VIDEO:
            watermark_media_async(media.pk)
        return media
