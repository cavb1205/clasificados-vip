from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

User = get_user_model()


class LoginThrottleTests(APITestCase):
    """El login se limita a 10/min por IP (anti fuerza bruta)."""

    def setUp(self):
        # Aísla el contador de throttle: limpia antes y después para no
        # contaminar (ni ser contaminado por) otros tests del proceso.
        cache.clear()
        self.addCleanup(cache.clear)
        User.objects.create_user(
            username="brute", email="brute@example.com", password="Sup3rSecret!", role="client"
        )

    def test_login_blocked_after_10_attempts(self):
        url = reverse("api:users:login")
        for _ in range(10):
            r = self.client.post(url, {"email": "brute@example.com", "password": "mala"}, format="json")
            self.assertEqual(r.status_code, status.HTTP_401_UNAUTHORIZED)
        r = self.client.post(url, {"email": "brute@example.com", "password": "mala"}, format="json")
        self.assertEqual(r.status_code, status.HTTP_429_TOO_MANY_REQUESTS)


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


class LogoutTests(APITestCase):
    def test_logout_expires_cookies_and_ends_session(self):
        User.objects.create_user(
            username="lo", email="lo@example.com", password="Sup3rSecret!", role="client"
        )
        self.client.post(
            reverse("api:users:login"),
            {"email": "lo@example.com", "password": "Sup3rSecret!"},
            format="json",
        )
        self.assertEqual(self.client.get(reverse("api:users:me")).status_code, status.HTTP_200_OK)
        r = self.client.post(reverse("api:users:logout"))
        self.assertEqual(r.status_code, status.HTTP_204_NO_CONTENT)
        # La cookie de acceso quedó vacía y expirada.
        self.assertEqual(r.cookies["access_token"].value, "")
        self.assertEqual(r.cookies["access_token"]["max-age"], 0)
        # Ya no autentica.
        self.assertEqual(self.client.get(reverse("api:users:me")).status_code, status.HTTP_401_UNAUTHORIZED)


class ChangePasswordTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="cp", email="cp@example.com", password="OldPass!23", role="client"
        )
        self.client.force_authenticate(self.user)

    def test_wrong_current_password_rejected(self):
        r = self.client.post(
            reverse("api:users:change-password"),
            {"current_password": "incorrecta", "new_password": "NuevaClave!45"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_change_password_ok(self):
        r = self.client.post(
            reverse("api:users:change-password"),
            {"current_password": "OldPass!23", "new_password": "NuevaClave!45"},
            format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NuevaClave!45"))
