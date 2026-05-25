from django.db.models.signals import post_save
from django.dispatch import receiver

from core.notifications import notify_admins
from .models import PaymentReceipt


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
