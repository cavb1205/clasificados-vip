from rest_framework import serializers

from core.image_processing import process_image
from core.video_processing import strip_video_metadata
from .models import MediaContent, profile_media_limits


class MediaContentSerializer(serializers.ModelSerializer):
    upload = serializers.FileField(write_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaContent
        fields = ["id", "media_type", "upload", "file_url", "order", "created_at"]
        read_only_fields = ["file_url", "created_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url

    def validate(self, attrs):
        # En PATCH (partial) no exigimos el contexto de perfil ni el límite,
        # porque la edición típica es solo `order`.
        if self.partial:
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

    def create(self, validated_data):
        upload = validated_data.pop("upload")
        profile = self.context["profile"]
        media = MediaContent(profile=profile, **validated_data)

        if media.media_type == MediaContent.MediaType.PHOTO:
            # Pipeline: strip EXIF/GPS + watermark + compresión JPEG.
            processed = process_image(upload.read(), filename_stem="photo")
            media.file.save(processed.name, processed, save=False)
        else:
            # Video: quitar metadata/GPS (ffmpeg) por privacidad.
            cleaned = strip_video_metadata(upload)
            media.file.save(cleaned.name, cleaned, save=False)
        media.save()
        return media
