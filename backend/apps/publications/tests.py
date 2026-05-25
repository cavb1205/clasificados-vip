from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.utils import timezone
from django.test import TestCase

from apps.profiles.models import ModelProfile
from .models import PaymentReceipt, Publication, SubscriptionPlan

User = get_user_model()


class _Base(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.user,
            stage_name="Luna",
            age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )


class PaymentApprovalTests(_Base):
    def test_approve_activates_and_sets_30_day_expiry(self):
        pub = Publication.objects.create(
            profile=self.profile, title="Anuncio", status=Publication.Status.PENDING_PAYMENT
        )
        receipt = PaymentReceipt.objects.create(publication=pub)

        receipt.approve()

        pub.refresh_from_db()
        self.assertEqual(pub.status, Publication.Status.ACTIVE)
        self.assertIsNotNone(pub.expires_at)
        delta = pub.expires_at - timezone.now()
        # ~30 días (con holgura por el tiempo de ejecución).
        self.assertGreater(delta, timedelta(days=29, hours=23))
        self.assertLess(delta, timedelta(days=30, minutes=1))
        self.assertTrue(pub.is_live)


class SubscriptionPlanTests(_Base):
    def test_activate_uses_plan_duration(self):
        plan = SubscriptionPlan.objects.create(
            name="Semanal", duration_days=7, price=12000
        )
        pub = Publication.objects.create(
            profile=self.profile, title="Anuncio", plan=plan,
            status=Publication.Status.PENDING_PAYMENT,
        )
        PaymentReceipt.objects.create(publication=pub).approve()

        pub.refresh_from_db()
        delta = pub.expires_at - timezone.now()
        self.assertGreater(delta, timedelta(days=6, hours=23))
        self.assertLess(delta, timedelta(days=7, minutes=1))

    def test_featured_plan_marks_publication_featured(self):
        plan = SubscriptionPlan.objects.create(
            name="Mensual Destacado", duration_days=30, price=55000, includes_featured=True
        )
        pub = Publication.objects.create(
            profile=self.profile, title="Top", plan=plan,
            status=Publication.Status.PENDING_PAYMENT,
        )
        self.assertFalse(pub.is_featured)
        PaymentReceipt.objects.create(publication=pub).approve()
        pub.refresh_from_db()
        self.assertTrue(pub.is_featured)

    def test_activate_without_plan_falls_back_to_default(self):
        pub = Publication.objects.create(
            profile=self.profile, title="Sin plan",
            status=Publication.Status.PENDING_PAYMENT,
        )
        PaymentReceipt.objects.create(publication=pub).approve()
        pub.refresh_from_db()
        delta = pub.expires_at - timezone.now()
        self.assertGreater(delta, timedelta(days=29, hours=23))


class RenewActionTests(_Base):
    def setUp(self):
        super().setUp()
        self.plan = SubscriptionPlan.objects.create(name="Semanal", duration_days=7, price=12000)
        self.expired = Publication.objects.create(
            profile=self.profile, title="Mi anuncio", plan=self.plan,
            status=Publication.Status.EXPIRED,
            expires_at=timezone.now() - timedelta(days=1),
        )

    def test_renew_creates_new_draft_with_same_plan_and_title(self):
        from rest_framework.test import APIClient
        client = APIClient()
        client.force_authenticate(self.user)
        resp = client.post(f"/api/v1/me/publications/{self.expired.id}/renew/", format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["title"], "Mi anuncio")
        self.assertEqual(resp.data["status"], Publication.Status.DRAFT)
        self.assertEqual(resp.data["plan"]["id"], self.plan.id)
        self.assertEqual(Publication.objects.filter(profile=self.profile).count(), 2)

    def test_cannot_renew_active_publication(self):
        from rest_framework.test import APIClient
        active = Publication.objects.create(
            profile=self.profile, title="Vigente", plan=self.plan,
            status=Publication.Status.ACTIVE, expires_at=timezone.now() + timedelta(days=5),
        )
        client = APIClient(); client.force_authenticate(self.user)
        resp = client.post(f"/api/v1/me/publications/{active.id}/renew/", format="json")
        self.assertEqual(resp.status_code, 400)


class ExpireCommandTests(_Base):
    def test_expire_command_marks_overdue_active_as_expired(self):
        overdue = Publication.objects.create(
            profile=self.profile,
            title="Vencida",
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        fresh = Publication.objects.create(
            profile=self.profile,
            title="Vigente",
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=10),
        )

        out = StringIO()
        call_command("expire_publications", stdout=out)

        overdue.refresh_from_db()
        fresh.refresh_from_db()
        self.assertEqual(overdue.status, Publication.Status.EXPIRED)
        self.assertEqual(fresh.status, Publication.Status.ACTIVE)
        self.assertIn("1 publicación", out.getvalue())

    def test_dry_run_does_not_modify(self):
        overdue = Publication.objects.create(
            profile=self.profile,
            title="Vencida",
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() - timedelta(hours=1),
        )
        call_command("expire_publications", "--dry-run", stdout=StringIO())
        overdue.refresh_from_db()
        self.assertEqual(overdue.status, Publication.Status.ACTIVE)


from django.core import mail
from django.test import override_settings


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    ADMINS=[("Admin", "admin@example.com")],
)
class PaymentNotificationTests(_Base):
    def test_admin_receives_email_on_new_receipt(self):
        pub = Publication.objects.create(
            profile=self.profile, title="Anuncio",
            status=Publication.Status.PENDING_PAYMENT,
        )
        mail.outbox.clear()
        PaymentReceipt.objects.create(publication=pub, amount=12000)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("comprobante pendiente", mail.outbox[0].subject.lower())
