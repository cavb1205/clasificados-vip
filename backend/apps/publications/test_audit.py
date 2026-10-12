from datetime import timedelta
from io import BytesIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from apps.rooms.models import HostProfile, RoomReceipt
from .models import PaymentReceipt, Publication, SubscriptionPlan


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class PaymentAuditTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="audit-model", email="model@audit.invalid", role="model")
        self.profile = ModelProfile.objects.create(user=user, stage_name="Audit", age=25)
        self.plan = SubscriptionPlan.objects.create(name="Original", duration_days=7, price=12000, includes_featured=True)
        self.pub = Publication.objects.create(profile=self.profile, plan=self.plan, title="Audit")
        self.client.force_authenticate(user)

    def receipt(self):
        return PaymentReceipt.objects.create(publication=self.pub)

    def upload(self):
        raw = BytesIO()
        Image.new("RGB", (16, 16)).save(raw, "JPEG")
        return SimpleUploadedFile("receipt.jpg", raw.getvalue(), content_type="image/jpeg")

    def test_approval_uses_terms_at_upload_not_edited_plan(self):
        receipt = self.receipt()
        self.plan.duration_days = 90
        self.plan.price = 99000
        self.plan.includes_featured = False
        self.plan.save()
        receipt.approve()
        self.pub.refresh_from_db()
        self.assertTrue(self.pub.is_featured)
        self.assertAlmostEqual((self.pub.expires_at - timezone.now()).total_seconds(), 7 * 86400, delta=5)
        self.assertEqual(receipt.plan_snapshot["price"], 12000)

    def test_stale_receipt_object_cannot_extend_twice(self):
        receipt = self.receipt()
        stale = PaymentReceipt.objects.get(pk=receipt.pk)
        receipt.approve()
        self.pub.refresh_from_db()
        expiry = self.pub.expires_at
        stale.approve()
        self.pub.refresh_from_db()
        self.assertEqual(self.pub.expires_at, expiry)

    def test_pending_receipt_prevents_plan_change(self):
        self.receipt()
        other = SubscriptionPlan.objects.create(name="Other", duration_days=30, price=500)
        response = self.client.patch(f"/api/v1/me/publications/{self.pub.pk}/", {"plan_id": other.pk}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_room_plan_cannot_pay_for_model_publication(self):
        self.plan.kind = SubscriptionPlan.Kind.ROOM_LISTING
        self.plan.save()
        response = self.client.post("/api/v1/me/publications/", {"plan_id": self.plan.pk}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_duplicate_pending_upload_conflicts(self):
        self.receipt()
        response = self.client.post(f"/api/v1/me/publications/{self.pub.pk}/receipt/", {"image": self.upload()}, format="multipart")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(PaymentReceipt.objects.count(), 1)

    def test_payment_history_cannot_be_deleted(self):
        self.receipt()
        response = self.client.delete(f"/api/v1/me/publications/{self.pub.pk}/")
        self.assertEqual(response.status_code, 409)
        self.assertTrue(Publication.objects.filter(pk=self.pub.pk).exists())

    def test_unpaid_draft_can_be_deleted(self):
        self.assertEqual(self.client.delete(f"/api/v1/me/publications/{self.pub.pk}/").status_code, 204)

    def test_live_renewal_preserves_remaining_days(self):
        self.pub.activate()
        expiry = self.pub.expires_at
        self.receipt().approve()
        self.pub.refresh_from_db()
        self.assertEqual(self.pub.expires_at, expiry + timedelta(days=7))

    def test_admin_action_rejects_structured_input(self):
        admin = get_user_model().objects.create_user(username="audit-admin", email="admin@audit.invalid", role="admin", is_staff=True)
        self.client.force_authenticate(admin)
        receipt = self.receipt()
        response = self.client.post(f"/api/v1/admin/payments/{receipt.pk}/action/", {"action": {"approve": True}}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_revenue_includes_both_products_and_preserves_snapshot_prices(self):
        admin = get_user_model().objects.create_user(username="audit-admin", email="admin@audit.invalid", role="admin", is_staff=True)
        self.receipt().approve()
        self.plan.price = 99000
        self.plan.save()
        host_user = get_user_model().objects.create_user(username="audit-host", email="host@audit.invalid", role="host")
        host = HostProfile.objects.create(user=host_user, display_name="Host")
        plan = SubscriptionPlan.objects.create(name="Room", kind="room_listing", duration_days=30, price=18000)
        RoomReceipt.objects.create(owner=host, plan=plan).approve()
        self.client.force_authenticate(admin)
        response = self.client.get("/api/v1/admin/stats/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["revenue_month_clp"], 30000)
