from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.profiles.models import ModelProfile
from .models import Review

User = get_user_model()


class ReviewTests(APITestCase):
    def setUp(self):
        model_user = User.objects.create_user(
            username="luna", email="luna@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=model_user,
            stage_name="Luna",
            age=25,
            verification_status=ModelProfile.VerificationStatus.VERIFIED,
        )
        self.client_user = User.objects.create_user(
            username="cliente1", email="c1@example.com", password="x",
            role="client", email_verified=True,
        )

    def _post_review(self, rating=5):
        self.client.force_authenticate(self.client_user)
        return self.client.post(
            reverse("api:reviews:create"),
            {"profile_slug": self.profile.slug, "rating": rating, "comment": "Buena"},
            format="json",
        )

    def test_review_starts_pending_and_is_hidden_until_approved(self):
        resp = self._post_review()
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["status"], Review.Status.PENDING)

        # No aparece en el listado público mientras está pendiente.
        listing = self.client.get(
            reverse("api:reviews:list", args=[self.profile.slug])
        )
        self.assertEqual(len(listing.data), 0)

    def test_only_one_review_per_client(self):
        self.assertEqual(self._post_review().status_code, status.HTTP_201_CREATED)
        second = self._post_review(rating=1)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unverified_email_cannot_review(self):
        self.client_user.email_verified = False
        self.client_user.save()
        resp = self._post_review()
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_aggregate_rating_counts_only_approved(self):
        self._post_review(rating=4)
        review = Review.objects.get()
        review.status = Review.Status.APPROVED
        review.save()

        resp = self.client.get(reverse("api:reviews:rating", args=[self.profile.slug]))
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["average"], 4.0)
