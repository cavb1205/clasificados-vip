from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ModelProfile

User = get_user_model()


class PublicVisibilityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )

    def _make_profile(self, status_value):
        return ModelProfile.objects.create(
            user=self.user, stage_name="Luna", age=25, verification_status=status_value
        )

    def test_pending_profile_is_hidden(self):
        self._make_profile(ModelProfile.VerificationStatus.PENDING)
        resp = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 0)

    def test_verified_profile_is_visible(self):
        self._make_profile(ModelProfile.VerificationStatus.VERIFIED)
        resp = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["stage_name"], "Luna")
