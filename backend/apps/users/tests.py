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


class AdminUserManagementTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="ad", email="ad@example.com", password="x", role="admin", is_staff=True
        )
        self.client_user = User.objects.create_user(
            username="cl", email="cl@example.com", password="x", role="client"
        )

    def test_suspend_client_sets_inactive_and_logs(self):
        from apps.audit.models import AdminActionLog
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[self.client_user.id]),
            {"action": "suspend"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client_user.refresh_from_db()
        self.assertFalse(self.client_user.is_active)
        self.assertEqual(AdminActionLog.objects.filter(action="user.suspend").count(), 1)

    def test_cannot_suspend_staff(self):
        other = User.objects.create_user(username="s2", email="s2@example.com", password="x", is_staff=True)
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[other.id]),
            {"action": "suspend"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_requires_admin(self):
        self.client.force_authenticate(self.client_user)
        self.assertEqual(
            self.client.get(reverse("api:users:admin-users")).status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_set_role_moderator_does_not_grant_staff(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[self.client_user.id]),
            {"action": "set_role", "role": "moderator"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client_user.refresh_from_db()
        self.assertEqual(self.client_user.role, "moderator")
        self.assertFalse(self.client_user.is_staff)

    def test_set_role_admin_grants_staff_and_logs(self):
        from apps.audit.models import AdminActionLog
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[self.client_user.id]),
            {"action": "set_role", "role": "admin"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.client_user.refresh_from_db()
        self.assertTrue(self.client_user.is_staff)
        self.assertEqual(AdminActionLog.objects.filter(action="user.set_role").count(), 1)

    def test_set_role_rejects_invalid_role(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[self.client_user.id]),
            {"action": "set_role", "role": "wizard"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_modify_superuser(self):
        root = User.objects.create_superuser(username="root", email="root@example.com", password="x")
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[root.id]),
            {"action": "set_role", "role": "client"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cannot_modify_self(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-action", args=[self.admin.id]),
            {"action": "set_role", "role": "client"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)
