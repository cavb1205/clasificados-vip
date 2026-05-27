"""Revoca verificaciones aprobadas sin video de consentimiento.

Aplicar **una vez** después de adoptar el requisito de video en KYC: cualquier
perfil que haya sido verificado bajo el régimen anterior (solo cédula + selfie)
queda devuelto a estado pending para forzar re-verificación con el nuevo flujo.

Idempotente: re-ejecutar no hace nada si todos los verified ya tienen video.

Uso:
    python manage.py revoke_kyc_without_video           # ejecutar
    python manage.py revoke_kyc_without_video --dry-run # solo listar
"""

from django.core.management.base import BaseCommand

from apps.notifications.models import Notification, notify_user
from apps.profiles.models import ModelProfile
from apps.verification.models import VerificationRequest


class Command(BaseCommand):
    help = "Revoca aprobaciones KYC que no incluyen video de consentimiento."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        affected = []
        for profile in ModelProfile.objects.filter(
            verification_status=ModelProfile.VerificationStatus.VERIFIED
        ).select_related("user"):
            has_valid_vr = VerificationRequest.objects.filter(
                user=profile.user, status=VerificationRequest.Status.VERIFIED,
            ).exclude(consent_video="").exists()
            if not has_valid_vr:
                affected.append(profile)

        if opts["dry_run"]:
            self.stdout.write(
                self.style.WARNING(f"[dry-run] revocaría {len(affected)} perfil(es):")
            )
            for p in affected:
                self.stdout.write(f"  • {p.stage_name} ({p.user.email})")
            return

        for p in affected:
            p.verification_status = ModelProfile.VerificationStatus.PENDING
            p.verified_at = None
            p.save(update_fields=["verification_status", "verified_at"])
            notify_user(
                p.user, kind=Notification.Kind.KYC,
                title="⚠️ Re-verificación requerida",
                message=(
                    "Actualizamos los requisitos de verificación: ahora pedimos un "
                    "video corto de consentimiento. Por favor vuelve a enviar tus "
                    "documentos desde el dashboard."
                ),
                link="/dashboard",
            )
        self.stdout.write(
            self.style.SUCCESS(f"{len(affected)} perfil(es) devueltos a pending.")
        )
