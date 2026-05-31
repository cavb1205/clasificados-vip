from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.profiles.models import City, ModelProfile, Region
from apps.publications.models import SubscriptionPlan

from .models import HostProfile, RoomListing, RoomReceipt

User = get_user_model()


class _Base(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Metropolitana", slug="metropolitana")
        self.city = City.objects.create(region=self.region, name="Santiago", slug="santiago")

        # Anfitrión + su perfil.
        self.host_user = User.objects.create_user(
            username="host", email="host@example.com", password="x", role="host"
        )
        self.host = HostProfile.objects.create(
            user=self.host_user, display_name="Doña Rosa", whatsapp="56911111111"
        )

        # Modelo activa (verified + en trial → publicly_visible).
        self.model_user = User.objects.create_user(
            username="luna", email="luna@example.com", password="x", role="model"
        )
        self.active_profile = ModelProfile.objects.create(
            user=self.model_user, stage_name="Luna", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )

        # Modelo NO activa (verificada pero fuera de trial y sin publicación).
        self.inactive_user = User.objects.create_user(
            username="mia", email="mia@example.com", password="x", role="model"
        )
        self.inactive_profile = ModelProfile.objects.create(
            user=self.inactive_user, stage_name="Mia", age=24,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now() - timedelta(days=30),
        )

    def _live_listing(self, **kwargs):
        defaults = dict(
            owner=self.host, city=self.city, title="Pieza centro",
            price=200000, price_period=RoomListing.PricePeriod.MONTHLY,
            whatsapp="56922222222", status=RoomListing.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=10),
        )
        defaults.update(kwargs)
        return RoomListing.objects.create(**defaults)


class PaymentApprovalTests(_Base):
    def test_approve_activates_listing_with_default_30_days(self):
        listing = self._live_listing(
            status=RoomListing.Status.PENDING_PAYMENT, expires_at=None
        )
        RoomReceipt.objects.create(listing=listing).approve()

        listing.refresh_from_db()
        self.assertEqual(listing.status, RoomListing.Status.ACTIVE)
        delta = listing.expires_at - timezone.now()
        self.assertGreater(delta, timedelta(days=29, hours=23))
        self.assertTrue(listing.is_live)

    def test_approve_uses_plan_duration(self):
        plan = SubscriptionPlan.objects.create(
            name="Habitación semanal", duration_days=7, price=5000,
            kind=SubscriptionPlan.Kind.ROOM_LISTING,
        )
        listing = self._live_listing(
            plan=plan, status=RoomListing.Status.PENDING_PAYMENT, expires_at=None
        )
        RoomReceipt.objects.create(listing=listing).approve()

        listing.refresh_from_db()
        delta = listing.expires_at - timezone.now()
        self.assertGreater(delta, timedelta(days=6, hours=23))
        self.assertLess(delta, timedelta(days=7, minutes=1))


class GateTests(_Base):
    def test_active_model_sees_listings(self):
        self._live_listing()
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_inactive_model_is_forbidden(self):
        self._live_listing()
        self.client.force_authenticate(self.inactive_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_host_cannot_browse_listings(self):
        self.client.force_authenticate(self.host_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_is_unauthorized(self):
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))


class VisibilityTests(_Base):
    def test_paused_and_suspended_are_hidden(self):
        self._live_listing(is_paused=True)
        self._live_listing(is_suspended=True)
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(len(resp.data), 0)

    def test_serializer_exposes_contact_but_never_address(self):
        self._live_listing()
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        row = resp.data[0]
        self.assertEqual(row["city"], "Santiago")
        self.assertEqual(row["whatsapp"], "56922222222")
        # Privacidad: jamás un campo de dirección exacta.
        self.assertNotIn("address", row)
        self.assertNotIn("street", row)


class HostFlowTests(_Base):
    def test_host_creates_listing_inherits_contact(self):
        self.client.force_authenticate(self.host_user)
        resp = self.client.post(reverse("api:rooms:my-rooms-list"), {
            "title": "Pieza amoblada", "city_id": self.city.id,
            "price": 150000, "price_period": "monthly",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        listing = RoomListing.objects.get(id=resp.data["id"])
        self.assertEqual(listing.owner, self.host)
        # Hereda el WhatsApp del perfil del anfitrión.
        self.assertEqual(listing.whatsapp, "56911111111")
        self.assertEqual(listing.status, RoomListing.Status.DRAFT)

    def test_pause_and_resume(self):
        listing = self._live_listing()
        self.client.force_authenticate(self.host_user)
        self.client.post(reverse("api:rooms:my-rooms-pause", args=[listing.id]))
        listing.refresh_from_db()
        self.assertTrue(listing.is_paused)
        self.client.post(reverse("api:rooms:my-rooms-resume", args=[listing.id]))
        listing.refresh_from_db()
        self.assertFalse(listing.is_paused)


class ExpireCommandTests(_Base):
    def test_expire_rooms_marks_due_listings(self):
        self._live_listing(expires_at=timezone.now() - timedelta(hours=1))
        out = StringIO()
        call_command("expire_rooms", stdout=out)
        self.assertEqual(
            RoomListing.objects.filter(status=RoomListing.Status.EXPIRED).count(), 1
        )
