from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from apps.publications.models import PaymentReceipt, Publication
from .models import Notification, notify_user

User = get_user_model()


class NotificationsAPITests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.client.force_authenticate(self.user)

    def test_list_empty(self):
        resp = self.client.get(reverse("api:notifications:list"))
        self.assertEqual(len(resp.data), 0)

    def test_unread_count_and_mark_all_read(self):
        notify_user(self.user, kind="generic", title="Hola")
        notify_user(self.user, kind="generic", title="Hola 2")

        resp = self.client.get(reverse("api:notifications:unread-count"))
        self.assertEqual(resp.data["unread"], 2)

        self.client.post(reverse("api:notifications:mark-all-read"))
        resp = self.client.get(reverse("api:notifications:unread-count"))
        self.assertEqual(resp.data["unread"], 0)


class NotificationFromActionsTests(APITestCase):
    """Verifica que aprobaciones de pago crean notificaciones."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.user, stage_name="Luna", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )

    def test_approve_payment_creates_notification_for_owner(self):
        pub = Publication.objects.create(
            profile=self.profile, title="Anuncio",
            status=Publication.Status.PENDING_PAYMENT,
        )
        PaymentReceipt.objects.create(publication=pub).approve()
        n = Notification.objects.filter(recipient=self.user, kind="payment").first()
        self.assertIsNotNone(n)
        self.assertIn("Pago aprobado", n.title)
