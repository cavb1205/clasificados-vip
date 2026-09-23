from datetime import timedelta
from io import BytesIO, StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from apps.publications.models import Publication, SubscriptionPlan
from core.upload_validation import UploadValidationError, validate_video_upload
from core.video_processing import strip_video_metadata
from .models import MAX_STORIES_ALIVE, Story

User = get_user_model()


def _photo_bytes():
    b = BytesIO()
    Image.new("RGB", (200, 200), (0, 0, 0)).save(b, "JPEG")
    b.seek(0)
    return b


class _Base(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.user, stage_name="Luna", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )
        self.plan = SubscriptionPlan.objects.create(
            name="Premium", duration_days=30, price=50000, includes_featured=True,
        )
        self.client.force_authenticate(self.user)

    def _make_active_featured_pub(self):
        return Publication.objects.create(
            profile=self.profile, plan=self.plan, title="Premium",
            is_featured=True, status=Publication.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=15),
        )

    def _make_story(self):
        s = Story(profile=self.profile, kind="photo")
        s.file.save("s.jpg", ContentFile(b"x"), save=False)
        s.save()
        return s


class EligibilityTests(_Base):
    def test_cannot_upload_without_featured_publication(self):
        resp = self.client.post(
            reverse("api:stories:my-list"),
            {"upload": _photo_bytes()}, format="multipart",
        )
        self.assertEqual(resp.status_code, 403)

    def test_upload_with_featured_pub_succeeds_and_returns_url(self):
        self._make_active_featured_pub()
        resp = self.client.post(
            reverse("api:stories:my-list"),
            {"upload": _photo_bytes()}, format="multipart",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["kind"], "photo")
        self.assertIn("file_url", resp.data)


class VideoStoryPipelineTests(_Base):
    @patch("apps.stories.views.watermark_story_async")
    @patch("apps.stories.views.strip_video_metadata")
    def test_video_upload_uses_metadata_pipeline_and_watermark(
        self, strip_metadata, watermark
    ):
        self._make_active_featured_pub()
        cleaned = ContentFile(b"metadata-free", name="video-clean.mp4")
        strip_metadata.return_value = cleaned
        upload = SimpleUploadedFile(
            "raw.mp4", b"\x00\x00\x00\x18ftypisom", content_type="video/mp4"
        )

        response = self.client.post(
            reverse("api:stories:my-list"), {"upload": upload}, format="multipart"
        )

        self.assertEqual(response.status_code, 201)
        story = Story.objects.get(pk=response.data["id"])
        strip_metadata.assert_called_once()
        watermark.assert_called_once_with(story.pk)
        with story.file.open("rb") as stored:
            self.assertEqual(stored.read(), b"metadata-free")


class VideoUploadValidationTests(TestCase):
    def test_rejects_arbitrary_bytes_even_when_client_claims_video(self):
        upload = SimpleUploadedFile(
            "fake.mp4", b"not a video", content_type="video/mp4"
        )

        with self.assertRaises(UploadValidationError):
            validate_video_upload(upload)

    def test_accepts_supported_container_signatures(self):
        mp4 = SimpleUploadedFile(
            "video.mp4", b"\x00\x00\x00\x18ftypisom", content_type="video/mp4"
        )
        webm = SimpleUploadedFile(
            "video.webm", b"\x1a\x45\xdf\xa3\x00\x00\x00\x00", content_type="video/webm"
        )

        self.assertIs(validate_video_upload(mp4), mp4)
        self.assertIs(validate_video_upload(webm), webm)

    @patch("core.video_processing.shutil.which", return_value="/usr/bin/ffmpeg")
    @patch("core.video_processing.subprocess.run")
    def test_webm_cleanup_does_not_use_mp4_only_faststart_flag(
        self, run_ffmpeg, _which
    ):
        def write_output(command, **kwargs):
            self.assertNotIn("-movflags", command)
            with open(command[-1], "wb") as output:
                output.write(b"metadata-free")

        run_ffmpeg.side_effect = write_output
        upload = SimpleUploadedFile(
            "raw.webm",
            b"\x1a\x45\xdf\xa3\x00\x00\x00\x00",
            content_type="video/webm",
        )

        cleaned = strip_video_metadata(upload)

        self.assertEqual(cleaned.read(), b"metadata-free")


class PrivateStoryFileTests(_Base):
    def test_story_uses_private_storage_and_gated_file_endpoint(self):
        from rest_framework.test import APIClient

        field = Story._meta.get_field("file")
        self.assertEqual(field.storage.__class__.__name__, "PrivateMediaStorage")
        self._make_active_featured_pub()
        story = self._make_story()
        url = reverse("api:stories:file", args=[story.pk])
        response = APIClient().get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "private, no-store, max-age=0")

        story_url = reverse("api:stories:public-list", args=[self.profile.slug])
        listing = APIClient().get(story_url)
        self.assertEqual(listing.status_code, 200)
        self.assertIn(f"/api/v1/stories/{story.pk}/file/", listing.data[0]["file_url"])

    def test_story_file_is_hidden_when_profile_is_no_longer_public(self):
        self.profile.verified_at = timezone.now() - timedelta(days=60)
        self.profile.save(update_fields=["verified_at"])
        story = self._make_story()
        response = self.client.get(reverse("api:stories:file", args=[story.pk]))
        self.assertEqual(response.status_code, 404)


class CapacityTests(_Base):
    def test_failed_upload_does_not_remove_an_existing_story(self):
        self._make_active_featured_pub()
        existing = [self._make_story() for _ in range(MAX_STORIES_ALIVE)]
        existing_ids = {story.pk for story in existing}

        responses = [
            self.client.post(
                reverse("api:stories:my-list"), {}, format="multipart"
            ),
            self.client.post(
                reverse("api:stories:my-list"),
                {
                    "upload": SimpleUploadedFile(
                        "invalid.jpg", b"not an image", content_type="image/jpeg"
                    )
                },
                format="multipart",
            ),
        ]

        self.assertEqual([response.status_code for response in responses], [400, 400])
        self.assertSetEqual(
            set(Story.objects.filter(profile=self.profile).values_list("pk", flat=True)),
            existing_ids,
        )

    def test_exceeding_max_recycles_oldest(self):
        self._make_active_featured_pub()
        for _ in range(MAX_STORIES_ALIVE):
            self._make_story()
        self.client.post(
            reverse("api:stories:my-list"),
            {"upload": _photo_bytes()}, format="multipart",
        )
        self.assertEqual(
            Story.objects.filter(
                profile=self.profile, expires_at__gt=timezone.now()
            ).count(),
            MAX_STORIES_ALIVE,
        )


class ExpireCommandTests(TestCase):
    def test_command_deletes_expired(self):
        user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        profile = ModelProfile.objects.create(
            user=user, stage_name="X", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )
        s_old = Story(profile=profile, kind="photo")
        s_old.file.save("a.jpg", ContentFile(b"x"), save=False)
        s_old.save()
        Story.objects.filter(pk=s_old.pk).update(
            expires_at=timezone.now() - timedelta(hours=1)
        )
        s_new = Story(profile=profile, kind="photo")
        s_new.file.save("b.jpg", ContentFile(b"x"), save=False)
        s_new.save()

        call_command("delete_expired_stories", stdout=StringIO())
        self.assertFalse(Story.objects.filter(pk=s_old.pk).exists())
        self.assertTrue(Story.objects.filter(pk=s_new.pk).exists())


class CityStoriesViewTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.profiles.models import City, Region
        from apps.publications.models import Publication, SubscriptionPlan
        from django.utils import timezone
        from datetime import timedelta
        self.api = APIClient()
        region = Region.objects.create(name="RM", slug="rm")
        self.city = City.objects.create(name="Santiago", slug="santiago", region=region)
        u = User.objects.create_user(username="luna", email="l@e.com", password="x", role="model")
        self.profile = ModelProfile.objects.create(
            user=u, stage_name="Luna", age=25, city=self.city,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )
        plan = SubscriptionPlan.objects.create(name="P", price=1000, duration_days=30, includes_featured=True)
        Publication.objects.create(
            profile=self.profile, plan=plan, title="A",
            status=Publication.Status.ACTIVE, is_featured=True,
            expires_at=timezone.now() + timedelta(days=10),
        )
        Story.objects.create(profile=self.profile, kind="photo", file="stories/a.jpg")

    def test_city_with_active_story_returns_model(self):
        from django.urls import reverse
        r = self.api.get(reverse("api:stories:by-city"), {"region": "rm", "city": "santiago"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 1)
        self.assertEqual(r.data[0]["slug"], self.profile.slug)
        self.assertEqual(len(r.data[0]["stories"]), 1)

    def test_other_city_empty(self):
        from django.urls import reverse
        r = self.api.get(reverse("api:stories:by-city"), {"region": "rm", "city": "otra"})
        self.assertEqual(len(r.data), 0)


class PublicStoryVisibilityTests(_Base):
    def test_profile_stories_require_publicly_visible_profile(self):
        self.profile.verified_at = timezone.now() - timedelta(days=60)
        self.profile.save(update_fields=["verified_at"])
        story = self._make_story()

        response = self.client.get(
            reverse("api:stories:public-list", args=[self.profile.slug])
        )

        self.assertEqual(response.status_code, 404)
        self.assertTrue(Story.objects.filter(pk=story.pk).exists())

    def test_active_publication_makes_story_profile_visible(self):
        self.profile.verified_at = timezone.now() - timedelta(days=60)
        self.profile.save(update_fields=["verified_at"])
        self._make_active_featured_pub()
        self._make_story()

        response = self.client.get(
            reverse("api:stories:public-list", args=[self.profile.slug])
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
