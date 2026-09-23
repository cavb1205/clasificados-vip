import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.file_cleanup import delete_files_after_commit
from core.notifications import notify_admins
from .models import VerificationRequest

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=VerificationRequest)
def delete_kyc_files(sender, instance: VerificationRequest, **kwargs):
    """Borra los documentos sensibles solo si la eliminación SQL se confirma."""
    delete_files_after_commit(
        instance, ("id_document", "selfie", "consent_video"), logger
    )


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
