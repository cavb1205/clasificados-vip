from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from apps.publications.models import SubscriptionPlan
from .models import HostProfile, RoomListing, RoomPhoto, RoomReceipt


@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class RoomAuditTests(APITestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="audit-host", email="host@audit.invalid", role="host")
        self.host = HostProfile.objects.create(user=user, display_name="Host")
        self.plan = SubscriptionPlan.objects.create(name="Room", kind="room_listing", duration_days=30, max_listings=2, price=18000)
        self.host.apply_plan(self.plan)
        self.room = RoomListing.objects.create(owner=self.host, title="Room", price=10000)
        self.model_user = get_user_model().objects.create_user(username="audit-model", email="model@audit.invalid", role="model")
        ModelProfile.objects.create(user=self.model_user, stage_name="Audit", age=25, verification_status="verified", verified_at=timezone.now())
        self.client.force_authenticate(self.model_user)

    def test_same_plan_renewal_preserves_paid_expiry(self):
        expiry = self.host.plan_expires_at
        RoomReceipt.objects.create(owner=self.host, plan=self.plan).approve()
        self.host.refresh_from_db()
        self.assertEqual(self.host.plan_expires_at, expiry + timedelta(days=30))

    def test_pending_room_receipt_uses_original_slots_duration_and_featured(self):
        receipt = RoomReceipt.objects.create(owner=self.host, plan=self.plan)
        self.plan.max_listings = 1
        self.plan.duration_days = 5
        self.plan.includes_featured = True
        self.plan.save()
        expiry = self.host.plan_expires_at
        receipt.approve()
        self.host.refresh_from_db()
        self.assertEqual(self.host.plan_slots, 2)
        self.assertFalse(self.host.plan_featured)
        self.assertEqual(self.host.plan_expires_at, expiry + timedelta(days=30))

    def test_paused_and_suspended_rooms_consume_slots(self):
        self.room.publish()
        self.room.is_paused = True
        self.room.is_suspended = True
        self.room.save()
        self.assertEqual(self.host.used_slots(), 1)

    def test_expired_rooms_do_not_consume_slots_before_cron(self):
        self.room.publish()
        self.room.expires_at = timezone.now() - timedelta(seconds=1)
        self.room.save()
        self.assertEqual(self.host.used_slots(), 0)

    def test_downgrade_with_excess_live_rooms_rolls_back_payment(self):
        self.room.publish()
        other = RoomListing.objects.create(owner=self.host, title="Other", price=10000)
        other.publish()
        small = SubscriptionPlan.objects.create(name="Small", kind="room_listing", duration_days=30, max_listings=1, price=5000)
        receipt = RoomReceipt.objects.create(owner=self.host, plan=small)
        expiry = self.host.plan_expires_at
        with self.assertRaises(ValidationError):
            receipt.approve()
        receipt.refresh_from_db()
        self.host.refresh_from_db()
        self.assertEqual(receipt.status, "pending")
        self.assertEqual(self.host.plan_expires_at, expiry)

    def test_suspended_host_cannot_publish(self):
        self.host.is_suspended = True
        self.host.save()
        self.client.force_authenticate(self.host.user)
        response = self.client.post(f"/api/v1/me/rooms/{self.room.pk}/publish/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_hidden_room_photos_are_not_retrievable_by_active_models(self):
        photo = RoomPhoto.objects.create(listing=self.room, image="rooms/nonexistent-audit.jpg")
        url = f"/api/v1/room-photos/{photo.pk}/file/"
        self.assertEqual(self.client.get(url).status_code, 404)
        self.room.publish()
        with patch.object(photo.image.storage, "open", return_value=ContentFile(b"safe-photo")):
            visible = self.client.get(url)
            self.assertEqual(visible.status_code, 200)
            self.assertEqual(visible["Cache-Control"], "private, no-store, max-age=0")
            self.assertEqual(b"".join(visible.streaming_content), b"safe-photo")
        for attribute in ("is_paused", "is_suspended"):
            setattr(self.room, attribute, True)
            self.room.save()
            self.assertEqual(self.client.get(url).status_code, 404)
            setattr(self.room, attribute, False)
            self.room.save()

    def test_owner_can_preview_own_draft_photo(self):
        photo = RoomPhoto.objects.create(listing=self.room, image="rooms/nonexistent-audit.jpg")
        self.client.force_authenticate(self.host.user)
        with patch.object(photo.image.storage, "open", return_value=ContentFile(b"safe-photo")):
            response = self.client.get(f"/api/v1/room-photos/{photo.pk}/file/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(b"".join(response.streaming_content), b"safe-photo")

    def test_inactive_host_rooms_disappear_from_browse(self):
        self.room.publish()
        self.host.user.is_active = False
        self.host.user.save()
        self.assertEqual(self.client.get("/api/v1/rooms/").data, [])
        self.assertEqual(self.client.get(f"/api/v1/rooms/{self.room.pk}/").status_code, 404)

    def test_city_filter_rejects_invalid_input_without_500(self):
        self.assertEqual(self.client.get("/api/v1/rooms/?city_id=invalid").status_code, 400)
