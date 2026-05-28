from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from datetime import timedelta
from django.utils import timezone
from apps.publications.models import Publication, SubscriptionPlan
from apps.reviews.models import Review
from .models import ModelProfile, Service

User = get_user_model()


def _make_user(email="m@example.com"):
    return User.objects.create_user(username=email.split("@")[0], email=email, password="x", role="model")


class PublicVisibilityTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )

    def _make_profile(self, status_value):
        verified_at = (
            timezone.now() if status_value == ModelProfile.VerificationStatus.VERIFIED else None
        )
        return ModelProfile.objects.create(
            user=self.user, stage_name="Luna", age=25,
            verification_status=status_value, verified_at=verified_at,
        )

    def test_pending_profile_is_hidden(self):
        self._make_profile(ModelProfile.VerificationStatus.PENDING)
        resp = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 0)
        self.assertEqual(resp.data["results"], [])

    def test_verified_profile_is_visible(self):
        self._make_profile(ModelProfile.VerificationStatus.VERIFIED)
        resp = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["stage_name"], "Luna")


class FilterAndPaginationTests(APITestCase):
    def setUp(self):
        self.s_masaje = Service.objects.create(name="Masaje", slug="masaje")
        self.s_cena = Service.objects.create(name="Cena", slug="cena")
        for i in range(15):
            u = _make_user(f"m{i}@example.com")
            p = ModelProfile.objects.create(
                user=u, stage_name=f"M{i}", age=20 + i, base_rate=10000 + i * 1000,
                verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
            )
            # Asignar masaje a los pares, cena a los impares.
            p.services.add(self.s_masaje if i % 2 == 0 else self.s_cena)

    def test_default_page_size_is_12_and_pages_paginate(self):
        page1 = self.client.get(reverse("api:profiles:public-list"))
        self.assertEqual(page1.data["count"], 15)
        self.assertEqual(len(page1.data["results"]), 12)
        self.assertIsNotNone(page1.data["next"])
        page2 = self.client.get(reverse("api:profiles:public-list") + "?page=2")
        self.assertEqual(len(page2.data["results"]), 3)
        self.assertIsNone(page2.data["next"])

    def test_filter_by_service(self):
        url = reverse("api:profiles:public-list") + "?service=masaje&page_size=48"
        resp = self.client.get(url)
        self.assertEqual(resp.data["count"], 8)  # pares: 0,2,4,6,8,10,12,14

    def test_filter_by_age_range(self):
        url = reverse("api:profiles:public-list") + "?min_age=25&max_age=27&page_size=48"
        resp = self.client.get(url)
        ages = sorted(r["age"] for r in resp.data["results"])
        self.assertEqual(ages, [25, 26, 27])

    def test_full_text_search_by_name(self):
        url = reverse("api:profiles:public-list") + "?q=M7"
        resp = self.client.get(url)
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertEqual(names, ["M7"])

    def test_filter_by_rate_range(self):
        url = reverse("api:profiles:public-list") + "?min_rate=12000&max_rate=14000&page_size=48"
        resp = self.client.get(url)
        self.assertEqual(resp.data["count"], 3)  # 12000, 13000, 14000

    def test_services_endpoint_exposes_catalog(self):
        resp = self.client.get(reverse("api:profiles:services"))
        self.assertEqual(resp.status_code, 200)
        slugs = sorted(s["slug"] for s in resp.data)
        self.assertEqual(slugs, ["cena", "masaje"])
        # Cada item ahora trae category (default 'service' al no haberlo seteado).
        self.assertIn("category", resp.data[0])

    def test_tag_filter_is_and_mode(self):
        # Crear 3 perfiles con combinaciones distintas para validar AND.
        rubia = Service.objects.create(name="Rubia", slug="rubia", category="feature")
        u1 = _make_user("a@e.com"); u2 = _make_user("b@e.com")
        p1 = ModelProfile.objects.create(
            user=u1, stage_name="A", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )
        p2 = ModelProfile.objects.create(
            user=u2, stage_name="B", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )
        p1.services.add(self.s_masaje, rubia)   # masaje + rubia
        p2.services.add(self.s_masaje)           # solo masaje

        # AND: pedir masaje Y rubia → solo p1.
        url = reverse("api:profiles:public-list") + "?tag=masaje&tag=rubia"
        resp = self.client.get(url)
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertEqual(names, ["A"])


class HasProfilesFilterTests(APITestCase):
    """?has_profiles=true filtra regiones/comunas vacías."""

    def setUp(self):
        # 16 regiones existen de antes (seed_chile) en TestCase no aplica;
        # creamos a mano dos para aislar.
        from apps.profiles.models import Region, City
        r1 = Region.objects.create(name="Reg A", slug="reg-a", order=1)
        r2 = Region.objects.create(name="Reg B (vacía)", slug="reg-b", order=2)
        self.c_pop = City.objects.create(name="Pop", slug="pop", region=r1)
        City.objects.create(name="Empty", slug="empty", region=r1)
        City.objects.create(name="Sin perfiles", slug="sin", region=r2)
        # Un perfil verificado y en trial en c_pop.
        user = _make_user("u@ex.com")
        ModelProfile.objects.create(
            user=user, stage_name="Ana", age=25, city=self.c_pop,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )

    def test_regions_with_has_profiles_only_returns_populated(self):
        url = reverse("api:profiles:regions") + "?has_profiles=true"
        resp = self.client.get(url)
        slugs = sorted(r["slug"] for r in resp.data)
        self.assertEqual(slugs, ["reg-a"])

    def test_cities_with_has_profiles_only_returns_populated(self):
        url = reverse("api:profiles:cities") + "?region=reg-a&has_profiles=true"
        resp = self.client.get(url)
        slugs = sorted(c["slug"] for c in resp.data)
        self.assertEqual(slugs, ["pop"])

    def test_without_flag_returns_all(self):
        resp = self.client.get(reverse("api:profiles:cities") + "?region=reg-a")
        self.assertEqual(len(resp.data), 2)  # Pop + Empty


class ContactFieldsTests(APITestCase):
    """WhatsApp/Telegram se normalizan y validan al guardarse."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.client.force_authenticate(self.user)

    def _post(self, **extra):
        return self.client.post(
            "/api/v1/me/profile/",
            {"stage_name": "Luna", "age": 25, **extra},
            format="json",
        )

    def test_whatsapp_keeps_only_digits(self):
        resp = self._post(whatsapp="+56 9 1234 5678")
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["whatsapp"], "56912345678")

    def test_telegram_strips_prefix_and_arroba(self):
        resp = self._post(telegram="https://t.me/luna_chile")
        self.assertEqual(resp.data["telegram"], "luna_chile")

    def test_whatsapp_too_short_is_rejected(self):
        resp = self._post(whatsapp="123")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("whatsapp", resp.data)

    def test_telegram_invalid_chars_are_rejected(self):
        resp = self._post(telegram="luna chile!")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("telegram", resp.data)


class TrialVisibilityTests(APITestCase):
    """Reglas de visibilidad: verificado + (trial activo o publicación activa)."""

    def setUp(self):
        self.plan = SubscriptionPlan.objects.create(name="Mensual", duration_days=30, price=35000)

    def _make_verified_profile(self, name, verified_minutes_ago):
        u = _make_user(f"{name}@example.com")
        return ModelProfile.objects.create(
            user=u, stage_name=name, age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now() - timedelta(minutes=verified_minutes_ago),
        )

    def test_profile_visible_during_trial(self):
        from apps.profiles.models import SiteConfig
        SiteConfig.objects.update_or_create(pk=1, defaults={"trial_days": 1})
        self._make_verified_profile("Trial", verified_minutes_ago=10)
        resp = self.client.get(reverse("api:profiles:public-list"))
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertIn("Trial", names)

    def test_profile_hidden_after_trial_without_publication(self):
        from apps.profiles.models import SiteConfig
        SiteConfig.objects.update_or_create(pk=1, defaults={"trial_days": 1})
        # Verificado hace 2 días → trial vencido, sin publicación.
        self._make_verified_profile("Old", verified_minutes_ago=60 * 24 * 2)
        resp = self.client.get(reverse("api:profiles:public-list"))
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertNotIn("Old", names)

    def test_profile_visible_with_active_publication_even_after_trial(self):
        p = self._make_verified_profile("Paid", verified_minutes_ago=60 * 24 * 2)
        Publication.objects.create(
            profile=p, title="Anuncio", plan=self.plan,
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=10),
        )
        resp = self.client.get(reverse("api:profiles:public-list"))
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertIn("Paid", names)

    def test_detail_404_when_not_visible(self):
        p = self._make_verified_profile("Hidden", verified_minutes_ago=60 * 24 * 30)
        resp = self.client.get(reverse("api:profiles:public-detail", args=[p.slug]))
        self.assertEqual(resp.status_code, 404)


class ProfileStatsTests(APITestCase):
    """Eventos públicos + endpoint de stats para la dueña del perfil."""

    def setUp(self):
        self.user = _make_user("st@example.com")
        self.profile = ModelProfile.objects.create(
            user=self.user, stage_name="Luna", age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
        )

    def test_log_event_view(self):
        url = reverse("api:profiles:log-event", args=[self.profile.slug])
        self.assertEqual(self.client.post(url, {"kind": "view"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(url, {"kind": "contact"}, format="json").status_code, 201)
        self.assertEqual(self.client.post(url, {"kind": "x"}, format="json").status_code, 400)

    def test_log_event_only_visible_profiles(self):
        url = reverse("api:profiles:log-event", args=["fantasma"])
        self.assertEqual(self.client.post(url, {"kind": "view"}, format="json").status_code, 404)

    def test_stats_endpoint_returns_counters(self):
        url = reverse("api:profiles:log-event", args=[self.profile.slug])
        for _ in range(3):
            self.client.post(url, {"kind": "view"}, format="json")
        self.client.post(url, {"kind": "contact"}, format="json")

        self.client.force_authenticate(self.user)
        resp = self.client.get(reverse("api:profiles:my-profile-stats"))
        self.assertEqual(resp.data["views_total"], 3)
        self.assertEqual(resp.data["views_7d"], 3)
        self.assertEqual(resp.data["contacts_total"], 1)


class CardEnrichmentTests(APITestCase):
    """Verifica que el listado expone rating, is_featured y los ordena correctamente."""

    def setUp(self):
        self.plan = SubscriptionPlan.objects.create(
            name="Mensual", duration_days=30, price=35000
        )
        # 3 perfiles verificados.
        for i, name in enumerate(["Ana", "Bea", "Cami"]):
            u = _make_user(f"{name.lower()}@example.com")
            ModelProfile.objects.create(
                user=u, stage_name=name, age=25,
                verification_status=ModelProfile.VerificationStatus.VERIFIED,
            verified_at=timezone.now(),
            )

    def _make_featured_publication(self, profile):
        return Publication.objects.create(
            profile=profile, title="Top", plan=self.plan, is_featured=True,
            status=Publication.Status.ACTIVE,
            expires_at=timezone.now() + timedelta(days=7),
        )

    def test_response_includes_rating_and_featured_fields(self):
        resp = self.client.get(reverse("api:profiles:public-list"))
        first = resp.data["results"][0]
        for field in ("rating_average", "rating_count", "is_featured"):
            self.assertIn(field, first)
        # Sin reseñas todavía → 0 reseñas, average None.
        self.assertEqual(first["rating_count"], 0)
        self.assertIsNone(first["rating_average"])
        self.assertFalse(first["is_featured"])

    def test_featured_profile_ranks_first(self):
        bea = ModelProfile.objects.get(stage_name="Bea")
        self._make_featured_publication(bea)
        resp = self.client.get(reverse("api:profiles:public-list"))
        names = [r["stage_name"] for r in resp.data["results"]]
        self.assertEqual(names[0], "Bea")
        self.assertTrue(resp.data["results"][0]["is_featured"])

    def test_rating_aggregates_only_approved_reviews(self):
        ana = ModelProfile.objects.get(stage_name="Ana")
        client_a = User.objects.create_user(
            username="ca", email="ca@example.com", password="x",
            role="client", email_verified=True,
        )
        client_b = User.objects.create_user(
            username="cb", email="cb@example.com", password="x",
            role="client", email_verified=True,
        )
        Review.objects.create(profile=ana, client=client_a, rating=4, status=Review.Status.APPROVED)
        Review.objects.create(profile=ana, client=client_b, rating=2, status=Review.Status.PENDING)  # se ignora

        resp = self.client.get(reverse("api:profiles:public-list"))
        ana_row = next(r for r in resp.data["results"] if r["stage_name"] == "Ana")
        self.assertEqual(ana_row["rating_count"], 1)
        self.assertEqual(ana_row["rating_average"], 4.0)
