from datetime import timedelta
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.profiles.models import City, ModelProfile, Region, SiteConfig
from apps.publications.models import SubscriptionPlan

from .models import HostProfile, RoomListing, RoomReceipt

User = get_user_model()


_plan_seq = 0


def _room_plan(name=None, days=30, price=18000, slots=1, featured=False):
    global _plan_seq
    _plan_seq += 1
    return SubscriptionPlan.objects.create(
        name=name or f"Plan {_plan_seq}", duration_days=days, price=price,
        max_listings=slots, includes_featured=featured,
        kind=SubscriptionPlan.Kind.ROOM_LISTING,
    )


class _Base(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(name="Metropolitana", slug="metropolitana")
        self.city = City.objects.create(region=self.region, name="Santiago", slug="santiago")

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

    def _give_plan(self, *, slots=1, featured=False, days=30):
        self.host.apply_plan(_room_plan(days=days, slots=slots, featured=featured))

    def _new_listing(self, **kw):
        defaults = dict(
            owner=self.host, city=self.city, title="Pieza centro",
            price=200000, price_period=RoomListing.PricePeriod.MONTHLY,
            whatsapp="56922222222",
        )
        defaults.update(kw)
        return RoomListing.objects.create(**defaults)

    def _published(self, **kw):
        """Crea una pieza ya publicada (requiere plan activo en el host)."""
        if not self.host.subscription_active:
            self._give_plan(slots=10)
        listing = self._new_listing(**kw)
        listing.publish()
        return listing


class PlanApprovalTests(_Base):
    def test_approve_activates_host_plan(self):
        plan = _room_plan(days=30, slots=3, featured=True)
        RoomReceipt.objects.create(owner=self.host, plan=plan).approve()
        self.host.refresh_from_db()
        self.assertTrue(self.host.subscription_active)
        self.assertEqual(self.host.plan_slots, 3)
        self.assertTrue(self.host.plan_featured)
        delta = self.host.plan_expires_at - timezone.now()
        self.assertGreater(delta, timedelta(days=29, hours=23))


class PublishLimitTests(_Base):
    def test_publish_requires_active_plan(self):
        listing = self._new_listing()
        self.client.force_authenticate(self.host_user)
        resp = self.client.post(reverse("api:rooms:my-rooms-publish", args=[listing.id]))
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        listing.refresh_from_db()
        self.assertEqual(listing.status, RoomListing.Status.DRAFT)

    def test_plan_slots_limit_blocks_extra_publish(self):
        self._give_plan(slots=1)
        a, b = self._new_listing(title="A"), self._new_listing(title="B")
        self.client.force_authenticate(self.host_user)
        r1 = self.client.post(reverse("api:rooms:my-rooms-publish", args=[a.id]))
        r2 = self.client.post(reverse("api:rooms:my-rooms-publish", args=[b.id]))
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)  # sin cupos

    def test_bundle_allows_multiple(self):
        self._give_plan(slots=3)
        self.client.force_authenticate(self.host_user)
        for t in ("A", "B", "C"):
            r = self.client.post(
                reverse("api:rooms:my-rooms-publish", args=[self._new_listing(title=t).id])
            )
            self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertEqual(self.host.used_slots(), 3)

    def test_global_cap_overrides_plan_slots(self):
        cfg = SiteConfig.get()
        cfg.max_active_rooms_per_host = 1
        cfg.save()
        self._give_plan(slots=5)  # plan da 5, pero el tope global es 1
        a, b = self._new_listing(title="A"), self._new_listing(title="B")
        self.client.force_authenticate(self.host_user)
        r1 = self.client.post(reverse("api:rooms:my-rooms-publish", args=[a.id]))
        r2 = self.client.post(reverse("api:rooms:my-rooms-publish", args=[b.id]))
        self.assertEqual(r1.status_code, status.HTTP_200_OK)
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unpublish_frees_slot(self):
        self._give_plan(slots=1)
        a, b = self._new_listing(title="A"), self._new_listing(title="B")
        self.client.force_authenticate(self.host_user)
        self.client.post(reverse("api:rooms:my-rooms-publish", args=[a.id]))
        self.client.post(reverse("api:rooms:my-rooms-unpublish", args=[a.id]))
        r2 = self.client.post(reverse("api:rooms:my-rooms-publish", args=[b.id]))
        self.assertEqual(r2.status_code, status.HTTP_200_OK)


class FeaturedTests(_Base):
    def test_featured_plan_marks_and_orders_first(self):
        self._give_plan(slots=5, featured=True)
        normal = self._new_listing(title="Normal")
        normal.is_featured = False
        normal.status = RoomListing.Status.ACTIVE
        normal.expires_at = self.host.plan_expires_at
        normal.save()
        feat = self._new_listing(title="Destacada")
        feat.publish()  # hereda is_featured del plan
        self.assertTrue(feat.is_featured)

        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.data[0]["title"], "Destacada")  # destacada primero


class GateTests(_Base):
    def test_active_model_sees_published(self):
        self._published()
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_inactive_model_forbidden(self):
        self._published()
        self.client.force_authenticate(self.inactive_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_host_cannot_browse(self):
        self.client.force_authenticate(self.host_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_paused_and_suspended_hidden(self):
        self._published(is_paused=True)  # da plan con 10 cupos
        s = self._new_listing(title="S")
        s.publish()
        s.is_suspended = True
        s.save()
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list"))
        self.assertEqual(len(resp.data), 0)

    def test_serializer_never_exposes_address(self):
        self._published()
        self.client.force_authenticate(self.model_user)
        row = self.client.get(reverse("api:rooms:public-list")).data[0]
        self.assertEqual(row["whatsapp"], "56922222222")
        self.assertNotIn("address", row)
        self.assertNotIn("street", row)


class HostFlowTests(_Base):
    def test_create_listing_inherits_contact(self):
        self.client.force_authenticate(self.host_user)
        resp = self.client.post(reverse("api:rooms:my-rooms-list"), {
            "title": "Pieza amoblada", "city_id": self.city.id,
            "price": 150000, "price_period": "monthly",
        })
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        listing = RoomListing.objects.get(id=resp.data["id"])
        self.assertEqual(listing.whatsapp, "56911111111")
        self.assertEqual(listing.status, RoomListing.Status.DRAFT)


class ExpireCommandTests(_Base):
    def test_expire_rooms_marks_due(self):
        listing = self._published()
        listing.expires_at = timezone.now() - timedelta(hours=1)
        listing.save()
        out = StringIO()
        call_command("expire_rooms", stdout=out)
        self.assertEqual(
            RoomListing.objects.filter(status=RoomListing.Status.EXPIRED).count(), 1
        )


class AvailabilityAndReportTests(_Base):
    def test_host_sets_available_now_and_filter(self):
        listing = self._published()
        self.client.force_authenticate(self.host_user)
        r = self.client.post(
            reverse("api:rooms:my-rooms-availability", args=[listing.id]),
            {"minutes": 60}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_200_OK)
        self.assertTrue(r.data["is_available_now"])
        # La modelo activa la ve con el filtro available_now=true
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list") + "?available_now=true")
        self.assertEqual(len(resp.data), 1)

    def test_available_now_filter_excludes_others(self):
        self._published()  # sin disponibilidad
        self.client.force_authenticate(self.model_user)
        resp = self.client.get(reverse("api:rooms:public-list") + "?available_now=true")
        self.assertEqual(len(resp.data), 0)

    def test_active_model_reports_room(self):
        from .models import RoomReport
        listing = self._published()
        self.client.force_authenticate(self.model_user)
        r = self.client.post(
            reverse("api:rooms:report", args=[listing.id]),
            {"reason": "spam"}, format="json",
        )
        self.assertEqual(r.status_code, status.HTTP_201_CREATED)
        self.assertEqual(RoomReport.objects.filter(listing=listing).count(), 1)

    def test_inactive_model_cannot_report(self):
        listing = self._published()
        self.client.force_authenticate(self.inactive_user)
        r = self.client.post(reverse("api:rooms:report", args=[listing.id]), {}, format="json")
        self.assertEqual(r.status_code, status.HTTP_403_FORBIDDEN)


class HostSuspensionTests(_Base):
    def test_suspended_host_hides_all_listings(self):
        self._published()  # pieza activa visible
        self.client.force_authenticate(self.model_user)
        self.assertEqual(len(self.client.get(reverse("api:rooms:public-list")).data), 1)
        self.host.is_suspended = True
        self.host.save()
        self.assertEqual(len(self.client.get(reverse("api:rooms:public-list")).data), 0)
