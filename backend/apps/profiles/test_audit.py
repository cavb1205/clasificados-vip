from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.publications.models import Publication
from apps.reviews.models import Review
from core.image_processing import process_image
from core.upload_validation import UploadValidationError, validate_image_bytes
from .models import Favorite, ModelProfile


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class VisibilityAuditTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="audit-model", email="model@audit.invalid", role="model")
        self.profile = ModelProfile.objects.create(user=self.user, stage_name="Audit", age=25, verification_status="verified", verified_at=timezone.now())
        self.viewer = get_user_model().objects.create_user(username="audit-viewer", email="viewer@audit.invalid", role="client")
        self.client.force_authenticate(self.viewer)

    def test_multiple_live_publications_do_not_duplicate_profile_or_break_contact(self):
        for i in range(2):
            Publication.objects.create(profile=self.profile, title=f"Ad {i}", status="active", expires_at=timezone.now() + timedelta(days=7))
        Review.objects.create(profile=self.profile, client=self.viewer, rating=5, status="approved")
        response = self.client.get("/api/v1/profiles/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(self.client.post(f"/api/v1/profiles/{self.profile.slug}/contact/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/profiles/{self.profile.slug}/rating/").data["count"], 1)

    def test_inactive_account_is_hidden_in_public_reads_and_favorites(self):
        Favorite.objects.create(user=self.viewer, profile=self.profile)
        self.user.is_active = False
        self.user.save()
        self.assertEqual(self.client.get("/api/v1/profiles/").data["count"], 0)
        self.assertEqual(self.client.get("/api/v1/me/favorites/").data, [])
        for suffix in ("", "reviews/", "rating/"):
            self.assertEqual(self.client.get(f"/api/v1/profiles/{self.profile.slug}/{suffix}").status_code, 404)
        self.assertEqual(self.client.post(f"/api/v1/profiles/{self.profile.slug}/contact/").status_code, 404)

    def test_cannot_add_hidden_profile_as_favorite(self):
        self.profile.is_suspended = True
        self.profile.save()
        self.assertEqual(self.client.post(f"/api/v1/profiles/{self.profile.slug}/favorite/").status_code, 404)

    def test_can_remove_existing_hidden_favorite(self):
        Favorite.objects.create(user=self.viewer, profile=self.profile)
        self.profile.is_suspended = True
        self.profile.save()
        self.assertEqual(self.client.post(f"/api/v1/profiles/{self.profile.slug}/favorite/").data, {"favorited": False})

    def test_invalid_numeric_filters_do_not_raise_server_errors(self):
        for value in ("²", "9" * 100, "2147483648"):
            self.assertEqual(self.client.get("/api/v1/profiles/", {"min_age": value}).status_code, 200)

    def test_legacy_media_bypass_is_closed(self):
        self.assertEqual(self.client.get("/media/receipts/test.jpg").status_code, 404)

    def test_mobile_orientation_applied_and_exif_removed(self):
        image = Image.new("RGB", (80, 40), "red")
        exif = Image.Exif()
        exif[274] = 6
        exif[315] = "Private author"
        raw = BytesIO()
        image.save(raw, "JPEG", exif=exif)
        output = process_image(raw.getvalue(), watermark=False)
        with Image.open(output) as cleaned:
            self.assertEqual(cleaned.size, (40, 80))
            self.assertFalse(cleaned.getexif())

    def test_false_mime_cannot_allow_gif_content(self):
        raw = BytesIO()
        Image.new("RGB", (16, 16)).save(raw, "GIF")
        with self.assertRaises(UploadValidationError):
            validate_image_bytes(raw.getvalue())
