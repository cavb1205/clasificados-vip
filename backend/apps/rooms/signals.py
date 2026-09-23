import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.file_cleanup import delete_files_after_commit
from .models import RoomPhoto, RoomReceipt

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=RoomPhoto)
def delete_room_photo_file(sender, instance: RoomPhoto, **kwargs):
    delete_files_after_commit(instance, ("image",), logger)


@receiver(post_delete, sender=RoomReceipt)
def delete_room_receipt_file(sender, instance: RoomReceipt, **kwargs):
    delete_files_after_commit(instance, ("image",), logger)
