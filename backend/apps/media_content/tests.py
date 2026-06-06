from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from PIL import Image

from apps.profiles.models import ModelProfile
from core.image_processing import has_gps_metadata, process_image
from .models import MediaContent

User = get_user_model()


def _image_with_exif_gps() -> bytes:
    """Genera un JPEG con tag EXIF 'Software' y coordenadas GPS."""
    img = Image.new("RGB", (2000, 1200), (10, 120, 200))
    exif = img.getexif()
    exif[0x0131] = "TestCamera 1.0"  # Software
    gps = exif.get_ifd(0x8825)
    gps[1] = "S"
    gps[2] = (33.0, 27.0, 0.0)  # Santiago aprox.
    buffer = BytesIO()
    img.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


class ImageProcessingTests(TestCase):
    def setUp(self):
        self.raw = _image_with_exif_gps()

    def test_input_actually_has_gps(self):
        self.assertTrue(has_gps_metadata(self.raw))

    def test_pipeline_strips_all_exif_and_gps(self):
        result = process_image(self.raw)
        processed = result.read()
        self.assertFalse(has_gps_metadata(processed))
        with Image.open(BytesIO(processed)) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertEqual(len(img.getexif()), 0)  # sin metadatos

    def test_pipeline_resizes_and_compresses(self):
        result = process_image(self.raw)
        processed = result.read()
        with Image.open(BytesIO(processed)) as img:
            self.assertLessEqual(max(img.size), 1600)
        # La compresión debe reducir el tamaño respecto al original sin comprimir.
        self.assertLess(len(processed), len(self.raw))


@override_settings(MAX_PHOTOS_PER_PROFILE=2, MAX_VIDEOS_PER_PROFILE=1)
class MediaLimitTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(user=user, stage_name="Luna", age=25)

    def _make_photo(self):
        from django.core.files.base import ContentFile

        media = MediaContent(profile=self.profile, media_type="photo")
        media.file.save("p.jpg", ContentFile(b"data"), save=False)
        media.full_clean()
        media.save()

    def test_reorder_via_patch_only_updates_order(self):
        from rest_framework.test import APIClient
        self._make_photo()
        self._make_photo()
        first = MediaContent.objects.first()
        client = APIClient()
        client.force_authenticate(self.profile.user)
        resp = client.patch(f"/api/v1/me/media/{first.id}/", {"order": 9}, format="json")
        self.assertEqual(resp.status_code, 200)
        first.refresh_from_db()
        self.assertEqual(first.order, 9)

    def test_photo_limit_enforced(self):
        from django.core.exceptions import ValidationError

        self._make_photo()
        self._make_photo()
        with self.assertRaises(ValidationError):
            self._make_photo()  # tercera supera el límite de 2


class AdminMediaHideTests(TestCase):
    def setUp(self):
        from rest_framework.test import APIClient
        from apps.profiles.models import ModelProfile
        self.model_user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.model_user, stage_name="Luna", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )
        self.photo = MediaContent.objects.create(
            profile=self.profile, media_type="photo", file="profiles/media/a.jpg"
        )
        self.admin = User.objects.create_user(
            username="ad", email="ad@example.com", password="x", role="admin", is_staff=True
        )
        self.api = APIClient()

    def test_hide_excludes_from_public_photos(self):
        from django.urls import reverse
        self.api.force_authenticate(self.admin)
        r = self.api.post(
            reverse("api:media_content:admin-media-hide", args=[self.photo.id]),
            {"action": "hide"}, format="json",
        )
        self.assertEqual(r.status_code, 200)
        self.photo.refresh_from_db()
        self.assertTrue(self.photo.is_hidden)
        # Excluida del queryset público de fotos
        self.assertEqual(
            self.profile.media.filter(media_type="photo", is_hidden=False).count(), 0
        )

    def test_hide_requires_moderator(self):
        from django.urls import reverse
        self.api.force_authenticate(self.model_user)
        r = self.api.post(
            reverse("api:media_content:admin-media-hide", args=[self.photo.id]),
            {"action": "hide"}, format="json",
        )
        self.assertEqual(r.status_code, 403)


class FeaturedMediaLimitTests(TestCase):
    def setUp(self):
        from apps.profiles.models import ModelProfile
        from apps.publications.models import Publication, SubscriptionPlan
        from django.utils import timezone
        from datetime import timedelta
        self.u = User.objects.create_user(username="f", email="f@e.com", password="x", role="model")
        self.profile = ModelProfile.objects.create(
            user=self.u, stage_name="Fea", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )
        plan = SubscriptionPlan.objects.create(name="Dest", price=30000, duration_days=30, includes_featured=True)
        Publication.objects.create(
            profile=self.profile, plan=plan, title="A",
            status=Publication.Status.ACTIVE, is_featured=True,
            expires_at=timezone.now() + timedelta(days=10),
        )

    def test_featured_allows_more_photos(self):
        from apps.media_content.models import profile_media_limits
        max_photos, max_videos = profile_media_limits(self.profile)
        self.assertEqual(max_photos, 10)
        self.assertEqual(max_videos, 2)
