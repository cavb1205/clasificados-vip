from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ModelProfile, Service

User = get_user_model()


def _make_user(email="m@example.com"):
    return User.objects.create_user(username=email.split("@")[0], email=email, password="x", role="model")


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
        self.assertEqual(resp.data["count"], 0)
        self.assertEqual(resp.data["results"], [])

    def test_verified_profile_is_visible(self):
        self._make_profile(ModelProfile.VerificationStatus.VERIFIED)
        resp = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["stage_name"], "Luna")


class FilterAndPaginationTests(APITestCase):
    def setUp(self):
        self.s_masaje = Service.objects.create(name="Masaje", slug="masaje")
        self.s_cena = Service.objects.create(name="Cena", slug="cena")
        for i in range(15):
            u = _make_user(f"m{i}@example.com")
            p = ModelProfile.objects.create(
                user=u, stage_name=f"M{i}", age=20 + i, base_rate=10000 + i * 1000,
                verification_status=ModelProfile.VerificationStatus.VERIFIED,
            )
            # Asignar masaje a los pares, cena a los impares.
            p.services.add(self.s_masaje if i % 2 == 0 else self.s_cena)

    def test_default_page_size_is_12_and_pages_paginate(self):
        page1 = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(page1.data["count"], 15)
        self.assertEqual(len(page1.data["results"]), 12)
        self.assertIsNotNone(page1.data["next"])
        page2 = self.client.get(reverse("api:profiles:public-list") + "?page=2")
        self.assertEqual(len(page2.data["results"]), 3)
        self.assertIsNone(page2.data["next"])

    def test_filter_by_service(self):
        url = reverse("api:profiles:public-list") + "?service=masaje&page_size=48"
        resp = self.client.get(url)
        self.assertEqual(resp.data["count"], 8)  # pares: 0,2,4,6,8,10,12,14

    def test_filter_by_age_range(self):
        url = reverse("api:profiles:public-list") + "?min_age=25&max_age=27&page_size=48"
        resp = self.client.get(url)
        ages = sorted(r["age"] for r in resp.data["results"])
        self.assertEqual(ages, [25, 26, 27])

    def test_filter_by_rate_range(self):
        url = reverse("api:profiles:public-list") + "?min_rate=12000&max_rate=14000&page_size=48"
        resp = self.client.get(url)
        self.assertEqual(resp.data["count"], 3)  # 12000, 13000, 14000

    def test_services_endpoint_exposes_catalog(self):
        resp = self.client.get(reverse("api:profiles:services"))
        self.assertEqual(resp.status_code, 200)
        slugs = sorted(s["slug"] for s in resp.data)
        self.assertEqual(slugs, ["cena", "masaje"])
