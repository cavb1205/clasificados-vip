from django.db.models.signals import post_save
from django.dispatch import receiver

from core.notifications import notify_admins
from .models import VerificationRequest


@receiver(post_save, sender=VerificationRequest)
def notify_kyc_pending(sender, instance: VerificationRequest, created: bool, **kwargs):
    """Avisa al admin cuando entra una nueva solicitud KYC pendiente."""
    if created and instance.status == VerificationRequest.Status.PENDING:
        notify_admins(
            subject=f"Nueva verificación KYC pendiente: {instance.user.email}",
            message=(
                f"El usuario {instance.user.email} subió documentos KYC.\n"
                f"Revísalos en el panel de admin."
            ),
        )
