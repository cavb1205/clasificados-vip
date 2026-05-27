from django.contrib.auth import get_user_model
from django.core import mail
from django.test import RequestFactory, TestCase, override_settings

from apps.profiles.models import ModelProfile
from .admin import VerificationRequestAdmin
from .models import VerificationRequest
from django.contrib.admin.sites import AdminSite

User = get_user_model()
SECRET_DOC = b"\x89PNG fake-cedula-bytes \x00\x01\x02"


class KYCEncryptionTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )

    def test_file_stored_encrypted_and_roundtrips(self):
        req = VerificationRequest(user=self.user)
        req.store_encrypted("id_document", SECRET_DOC)
        req.store_encrypted("selfie", b"selfie-bytes")
        req.save()

        # Lo que quedó en disco NO es el texto plano.
        with req.id_document.open("rb") as fh:
            on_disk = fh.read()
        self.assertNotEqual(on_disk, SECRET_DOC)
        self.assertNotIn(b"fake-cedula", on_disk)

        # Pero se puede descifrar de vuelta al original.
        self.assertEqual(req.read_decrypted("id_document"), SECRET_DOC)


class ApprovalFlowTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="x"
        )
        self.model_user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.model_user, stage_name="Luna", age=25
        )
        self.req = VerificationRequest(user=self.model_user)
        self.req.store_encrypted("id_document", SECRET_DOC)
        self.req.store_encrypted("selfie", b"s")
        # Video de consentimiento ahora obligatorio para aprobación.
        self.req.store_encrypted("consent_video", b"fake-video")
        self.req.save()

    def test_admin_approval_marks_profile_verified(self):
        self.assertEqual(
            self.profile.verification_status, ModelProfile.VerificationStatus.PENDING
        )
        admin = VerificationRequestAdmin(VerificationRequest, AdminSite())
        request = RequestFactory().post("/")
        request.user = self.admin_user
        # message_user requiere middleware de mensajes; lo neutralizamos.
        admin.message_user = lambda *a, **k: None
        admin.approve(request, VerificationRequest.objects.filter(pk=self.req.pk))

        self.profile.refresh_from_db()
        self.req.refresh_from_db()
        self.assertEqual(self.req.status, VerificationRequest.Status.VERIFIED)
        self.assertEqual(
            self.profile.verification_status, ModelProfile.VerificationStatus.VERIFIED
        )


class ApprovalRequiresVideoTests(TestCase):
    """No se puede aprobar una VR que no tenga consent_video."""

    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            username="admin", email="admin@example.com", password="x"
        )
        self.model_user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(
            user=self.model_user, stage_name="NoVideo", age=25
        )
        self.req = VerificationRequest(user=self.model_user)
        self.req.store_encrypted("id_document", b"x")
        self.req.store_encrypted("selfie", b"y")
        # NO almacenamos consent_video → la VR no tiene video.
        self.req.save()

    def test_action_skips_when_no_video(self):
        admin = VerificationRequestAdmin(VerificationRequest, AdminSite())
        request = RequestFactory().post("/")
        request.user = self.admin_user
        admin.message_user = lambda *a, **k: None
        admin.approve(request, VerificationRequest.objects.filter(pk=self.req.pk))
        self.req.refresh_from_db()
        self.profile.refresh_from_db()
        self.assertEqual(self.req.status, VerificationRequest.Status.PENDING)
        self.assertEqual(self.profile.verification_status, ModelProfile.VerificationStatus.PENDING)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    ADMINS=[("Admin", "admin@example.com")],
)
class KYCNotificationTests(TestCase):
    def test_admin_receives_email_on_new_kyc(self):
        user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        mail.outbox.clear()
        req = VerificationRequest(user=user)
        req.store_encrypted("id_document", b"x")
        req.store_encrypted("selfie", b"y")
        req.save()
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("KYC pendiente", mail.outbox[0].subject)
        self.assertIn("m@example.com", mail.outbox[0].body)
