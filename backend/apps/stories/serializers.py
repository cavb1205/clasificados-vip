from rest_framework import serializers

from .models import Story


class StorySerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Story
        fields = ["id", "kind", "file_url", "created_at", "expires_at"]
        read_only_fields = fields

    def get_file_url(self, obj):
        request = self.context.get("request")
        url = obj.file.url
        return request.build_absolute_uri(url) if request else url


class UploadStorySerializer(serializers.ModelSerializer):
    upload = serializers.FileField(write_only=True)

    class Meta:
        model = Story
        fields = ["id", "kind", "upload", "expires_at"]
        read_only_fields = ["id", "expires_at"]
