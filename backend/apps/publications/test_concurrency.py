from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from apps.profiles.models import ModelProfile
from .models import PaymentReceipt, Publication, SubscriptionPlan


@skipUnless(connection.vendor == "postgresql", "Los bloqueos requieren PostgreSQL real.")
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class ConcurrentPaymentTests(TransactionTestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(username="concurrent", email="concurrent@audit.invalid", role="model")
        profile = ModelProfile.objects.create(user=user, stage_name="Concurrent", age=25)
        plan = SubscriptionPlan.objects.create(name="Concurrency", duration_days=7, price=10000)
        self.expiry = timezone.now() + timedelta(days=10)
        self.pub = Publication.objects.create(profile=profile, plan=plan, title="Concurrency", status="active", expires_at=self.expiry)

    def approve_in_parallel(self, ids):
        barrier = Barrier(2)

        def approve(pk):
            close_old_connections()
            try:
                receipt = PaymentReceipt.objects.get(pk=pk)
                barrier.wait(timeout=10)
                return receipt.approve()
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(list(pool.map(approve, ids)), [True, True])
        self.pub.refresh_from_db()

    def test_two_approvals_of_same_receipt_extend_only_once(self):
        receipt = PaymentReceipt.objects.create(publication=self.pub)
        self.approve_in_parallel([receipt.pk, receipt.pk])
        self.assertEqual(self.pub.expires_at, self.expiry + timedelta(days=7))

    def test_different_receipts_for_same_publication_do_not_lose_days(self):
        ids = [PaymentReceipt.objects.create(publication=self.pub).pk for _ in range(2)]
        self.approve_in_parallel(ids)
        self.assertEqual(self.pub.expires_at, self.expiry + timedelta(days=14))
