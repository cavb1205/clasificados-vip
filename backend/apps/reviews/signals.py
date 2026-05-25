from django.db.models.signals import post_save
from django.dispatch import receiver

from core.notifications import notify_admins
from .models import Review


@receiver(post_save, sender=Review)
def notify_review_pending(sender, instance: Review, created: bool, **kwargs):
    """Avisa al admin cuando una reseña nueva queda pendiente de moderación."""
    if created and instance.status == Review.Status.PENDING:
        notify_admins(
            subject=f"Reseña pendiente · {instance.profile.stage_name}",
            message=(
                f"{instance.client.email} dejó una reseña de {instance.rating}★ "
                f"en el perfil {instance.profile.stage_name}.\n\n"
                f"Comentario:\n{instance.comment or '(sin comentario)'}"
            ),
        )
