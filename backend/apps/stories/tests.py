from datetime import timedelta
from io import BytesIO, StringIO

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from apps.publications.models import Publication, SubscriptionPlan
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


class CapacityTests(_Base):
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
