from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from .models import LegalAcceptance, PrivacyRequest

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


class RefreshTokenTests(APITestCase):
    def setUp(self):
        self.client = APIClient(enforce_csrf_checks=True)
        self.user = User.objects.create_user(
            username="refresh", email="refresh@example.com",
            password="Sup3rSecret!", role="client",
        )

    def _login(self):
        response = self.client.post(
            reverse("api:users:login"),
            {"email": self.user.email, "password": "Sup3rSecret!"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def _csrf(self):
        response = self.client.get(reverse("api:users:csrf"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return response.data["csrftoken"]

    def test_refresh_rotates_and_blacklists_previous_token(self):
        self._login()
        csrf = self._csrf()
        old_refresh = self.client.cookies["refresh_token"].value

        response = self.client.post(
            reverse("api:users:refresh"), {},
            HTTP_X_CSRFTOKEN=csrf,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_refresh = self.client.cookies["refresh_token"].value
        self.assertNotEqual(old_refresh, new_refresh)

        self.client.cookies["refresh_token"] = old_refresh
        rejected = self.client.post(
            reverse("api:users:refresh"), {},
            HTTP_X_CSRFTOKEN=csrf,
        )
        self.assertEqual(rejected.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_requires_csrf(self):
        self._login()
        response = self.client.post(reverse("api:users:refresh"), {})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_session_version_invalidates_old_access_tokens(self):
        self._login()
        self.user.session_version += 1
        self.user.save(update_fields=["session_version"])

        response = self.client.get(reverse("api:users:me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


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
        csrf = self.client.get(reverse("api:users:csrf")).data["csrftoken"]
        r = self.client.post(reverse("api:users:logout"), HTTP_X_CSRFTOKEN=csrf)
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

    def test_notify_creates_notification_and_logs(self):
        from apps.audit.models import AdminActionLog
        from apps.notifications.models import Notification
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-notify", args=[self.client_user.id]),
            {"message": "Corrige tu foto de perfil, por favor."}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(Notification.objects.filter(recipient=self.client_user).count(), 1)
        self.assertEqual(AdminActionLog.objects.filter(action="user.notify").count(), 1)

    def test_notify_requires_message(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(
            reverse("api:users:admin-user-notify", args=[self.client_user.id]),
            {"message": "   "}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_400_BAD_REQUEST)

    def test_notify_allowed_for_moderator(self):
        mod = User.objects.create_user(
            username="mod", email="mod@example.com", password="x", role="moderator"
        )
        self.client.force_authenticate(mod)
        r = self.client.post(
            reverse("api:users:admin-user-notify", args=[self.client_user.id]),
            {"message": "Hola"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)


class LegalAcceptanceTests(APITestCase):
    def test_registration_requires_separate_acceptance_and_records_versions(self):
        response = self.client.post(
            reverse("api:users:register"),
            {
                "email": "new@example.com",
                "username": "new-user",
                "password": "StrongPass!12345",
                "role": "host",
                "terms_accepted": True,
                "privacy_accepted": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        acceptance = LegalAcceptance.objects.get(user__email="new@example.com")
        self.assertEqual(acceptance.role, "host")
        self.assertEqual(acceptance.source, LegalAcceptance.Source.REGISTRATION)
        self.assertEqual(acceptance.terms_version, "2026-09-24-v1")
        self.assertEqual(acceptance.privacy_version, "2026-09-24-v1")

    def test_registration_rejects_missing_privacy_acceptance(self):
        response = self.client.post(
            reverse("api:users:register"),
            {
                "email": "new@example.com",
                "username": "new-user",
                "password": "StrongPass!12345",
                "role": "model",
                "terms_accepted": True,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_existing_user_can_read_and_record_current_acceptance(self):
        user = User.objects.create_user(
            username="existing", email="existing@example.com", password="x", role="client"
        )
        self.client.force_authenticate(user)
        url = reverse("api:users:legal-acceptance")
        self.assertFalse(self.client.get(url).data["current"])
        rejected = self.client.post(url, {"terms_accepted": True, "privacy_accepted": False}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        accepted = self.client.post(url, {"terms_accepted": True, "privacy_accepted": True}, format="json")
        self.assertEqual(accepted.status_code, status.HTTP_201_CREATED)
        self.assertTrue(accepted.data["current"])
        repeated = self.client.post(url, {"terms_accepted": True, "privacy_accepted": True}, format="json")
        self.assertEqual(repeated.status_code, status.HTTP_200_OK)
        self.assertEqual(LegalAcceptance.objects.filter(user=user).count(), 1)

    @override_settings(LEGAL_ACCEPTANCE_ENFORCEMENT=True)
    def test_enforcement_blocks_role_actions_until_documents_are_accepted(self):
        user = User.objects.create_user(
            username="model-gated", email="model-gated@example.com", password="x", role="model"
        )
        self.client.force_authenticate(user)
        profile_url = reverse("api:profiles:my-profile-list")
        self.assertEqual(self.client.get(profile_url).status_code, status.HTTP_403_FORBIDDEN)
        self.client.post(
            reverse("api:users:legal-acceptance"),
            {"terms_accepted": True, "privacy_accepted": True},
            format="json",
        )
        self.assertEqual(self.client.get(profile_url).status_code, status.HTTP_200_OK)


class PrivacyRequestTests(APITestCase):
    def test_closing_a_request_requires_an_outcome_note(self):
        owner = User.objects.create_user(
            username="privacy-owner", email="privacy-owner@example.com", password="x"
        )
        request = PrivacyRequest(
            user=owner,
            request_type=PrivacyRequest.RequestType.ERASURE,
            status=PrivacyRequest.Status.COMPLETED,
        )

        with self.assertRaises(ValidationError):
            request.full_clean()

        request.resolution_notes = "Se eliminó el perfil público; se conservará el comprobante por el plazo aplicable."
        request.full_clean()

    def test_only_authenticated_user_can_submit_and_view_own_requests(self):
        url = reverse("api:users:privacy-requests")
        self.assertEqual(
            self.client.post(url, {"request_type": "erasure"}, format="json").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        owner = User.objects.create_user(
            username="owner", email="owner@example.com", password="x", role="model"
        )
        other = User.objects.create_user(
            username="other", email="other@example.com", password="x", role="client"
        )
        self.client.force_authenticate(owner)
        created = self.client.post(
            url,
            {"request_type": "erasure", "details": "Eliminar datos de mi cuenta"},
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["status"], PrivacyRequest.Status.OPEN)
        self.assertEqual(self.client.get(url).data[0]["id"], created.data["id"])
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(url).data, [])
