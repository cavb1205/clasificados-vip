import logging

from django.db.models.signals import post_delete
from django.dispatch import receiver

from core.file_cleanup import delete_files_after_commit
from .models import Story

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Story)
def delete_story_file(sender, instance: Story, **kwargs):
    delete_files_after_commit(instance, ("file",), logger)
