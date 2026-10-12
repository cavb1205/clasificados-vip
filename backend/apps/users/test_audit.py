from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient, APITestCase


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class SessionAuditTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = get_user_model().objects.create_user(username="audit-user", email="Mixed@Example.com", password="SafePass!42", role="client")
        self.client = APIClient(enforce_csrf_checks=True)

    def login(self):
        csrf = self.client.get("/api/v1/auth/csrf/").data["csrftoken"]
        return self.client.post("/api/v1/auth/login/", {"email": "mixed@example.com", "password": "SafePass!42"}, format="json", HTTP_X_CSRFTOKEN=csrf)

    def test_login_requires_csrf(self):
        response = self.client.post("/api/v1/auth/login/", {"email": self.user.email, "password": "SafePass!42"}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_legacy_mixed_case_email_can_login(self):
        self.assertEqual(self.login().status_code, 200)

    def test_expired_access_cookie_does_not_block_csrf_or_login(self):
        self.client.cookies["access_token"] = "expired.invalid.token"
        self.assertEqual(self.client.get("/api/v1/auth/csrf/").status_code, 200)
        self.assertEqual(self.login().status_code, 200)

    def test_old_session_stays_revoked_after_unsuspension(self):
        self.assertEqual(self.login().status_code, 200)
        admin = get_user_model().objects.create_user(username="audit-admin", email="admin@audit.invalid", role="admin", is_staff=True)
        admin_client = APIClient()
        admin_client.force_authenticate(admin)
        url = f"/api/v1/auth/admin/users/{self.user.pk}/action/"
        for action in ("suspend", "unsuspend"):
            self.assertEqual(admin_client.post(url, {"action": action}, format="json").status_code, 200)
        self.assertEqual(self.client.get("/api/v1/auth/me/").status_code, 401)
        csrf = self.client.get("/api/v1/auth/csrf/").data["csrftoken"]
        self.assertEqual(self.client.post("/api/v1/auth/refresh/", {}, HTTP_X_CSRFTOKEN=csrf).status_code, 401)

    def test_structured_password_returns_400_not_500(self):
        csrf = self.client.get("/api/v1/auth/csrf/").data["csrftoken"]
        for body in ({"email": self.user.email, "password": {"value": "wrong"}}, [], ["unexpected"]):
            response = self.client.post("/api/v1/auth/login/", body, format="json", HTTP_X_CSRFTOKEN=csrf)
            self.assertEqual(response.status_code, 400)
