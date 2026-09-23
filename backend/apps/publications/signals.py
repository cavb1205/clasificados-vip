import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from core.notifications import notify_admins
from core.file_cleanup import delete_files_after_commit
from .models import PaymentReceipt

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=PaymentReceipt)
def delete_payment_receipt_file(sender, instance: PaymentReceipt, **kwargs):
    delete_files_after_commit(instance, ("image",), logger)


@receiver(post_save, sender=PaymentReceipt)
def notify_payment_pending(sender, instance: PaymentReceipt, created: bool, **kwargs):
    """Avisa al admin cuando llega un comprobante nuevo a revisar."""
    if created and instance.status == PaymentReceipt.Status.PENDING:
        pub = instance.publication
        notify_admins(
            subject=f"Nuevo comprobante pendiente · {pub.title}",
            message=(
                f"Perfil: {pub.profile.stage_name}\n"
                f"Anuncio: {pub.title}\n"
                f"Plan: {pub.plan.name if pub.plan else '(sin plan)'}\n"
                f"Monto declarado: ${instance.amount or '?'}\n"
                f"Revísalo en el panel de admin para activar la publicación."
            ),
        )
