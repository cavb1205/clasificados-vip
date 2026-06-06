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


class AdminGrantAndDetailTests(_Base):
    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient
        self.admin = User.objects.create_user(
            username="ad", email="ad@example.com", password="x", role="admin", is_staff=True
        )
        self.api = APIClient()
        self.api.force_authenticate(self.admin)

    def test_grant_extends_and_activates_draft(self):
        from django.urls import reverse
        pub = Publication.objects.create(
            profile=self.profile, title="A", status=Publication.Status.DRAFT
        )
        r = self.api.post(
            reverse("api:publications:admin-publication-grant", args=[pub.id]),
            {"days": 10}, format="json",
        )
        self.assertEqual(r.status_code, 200)
        pub.refresh_from_db()
        self.assertEqual(pub.status, Publication.Status.ACTIVE)
        self.assertTrue(pub.is_live)

    def test_grant_rejects_out_of_range(self):
        from django.urls import reverse
        pub = Publication.objects.create(profile=self.profile, title="A")
        r = self.api.post(
            reverse("api:publications:admin-publication-grant", args=[pub.id]),
            {"days": 999}, format="json",
        )
        self.assertEqual(r.status_code, 400)

    def test_profile_detail_returns_sections(self):
        from django.urls import reverse
        pub = Publication.objects.create(profile=self.profile, title="A")
        PaymentReceipt.objects.create(publication=pub, amount=12000)
        r = self.api.get(
            reverse("api:profiles:admin-profile-detail", args=[self.profile.id])
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data["publications"]), 1)
        self.assertEqual(len(r.data["receipts"]), 1)


class PublicationTitleAndPaymentTests(_Base):
    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient
        self.api = APIClient()
        self.api.force_authenticate(self.user)

    def test_create_without_title_autogenerates(self):
        from django.urls import reverse
        r = self.api.post(reverse("api:publications:my-publications-list"), {}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertIn(self.profile.stage_name, r.data["title"])

    def test_payment_info_endpoint(self):
        from django.urls import reverse
        from apps.profiles.models import SiteConfig
        cfg = SiteConfig.get(); cfg.payment_instructions = "Banco X 123"; cfg.save()
        r = self.api.get(reverse("api:publications:payment-info"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["payment_instructions"], "Banco X 123")


class RenewAheadTests(_Base):
    def test_approving_receipt_on_live_pub_extends(self):
        from datetime import timedelta
        from django.utils import timezone
        plan = SubscriptionPlan.objects.create(name="M", price=15000, duration_days=30)
        pub = Publication.objects.create(
            profile=self.profile, plan=plan, title="A",
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=5),
        )
        old_exp = pub.expires_at
        PaymentReceipt.objects.create(publication=pub).approve()
        pub.refresh_from_db()
        self.assertEqual(pub.status, Publication.Status.ACTIVE)
        # Se sumaron ~30 días al vencimiento previo (no se reseteó a now+30).
        delta = pub.expires_at - old_exp
        self.assertGreater(delta, timedelta(days=29, hours=23))
