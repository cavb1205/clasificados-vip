import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.file_cleanup import delete_files_after_commit
from .models import ModelProfile

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=ModelProfile)
def delete_profile_avatar(sender, instance: ModelProfile, **kwargs):
    delete_files_after_commit(instance, ("avatar",), logger)
