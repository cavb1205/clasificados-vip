from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

User = get_user_model()


class AuthCookieTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="modelo1", email="m1@example.com", password="Sup3rSecret!", role="model"
        )

    def test_login_sets_httponly_cookies(self):
        resp = self.client.post(
            reverse("api:users:login"),
            {"email": "m1@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        access = resp.cookies.get("access_token")
        self.assertIsNotNone(access)
        self.assertTrue(access["httponly"])

    def test_me_authenticates_via_cookie(self):
        self.client.post(
            reverse("api:users:login"),
            {"email": "m1@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        resp = self.client.get(reverse("api:users:me"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["email"], "m1@example.com")

    def test_write_without_csrf_is_rejected(self):
        """Con auth por cookie, un POST sin token CSRF debe fallar."""
        self.client.post(
            reverse("api:users:login"),
            {"email": "m1@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        # MyProfileViewSet create es escritura autenticada por cookie.
        resp = self.client.post(
            reverse("api:profiles:my-profile-list"),
            {"stage_name": "Luna", "age": 25},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
