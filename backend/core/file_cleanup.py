"""Helpers for removing stored files only after their database row is committed."""

import logging
from functools import partial

from django.db import transaction


def _delete_file(storage, name: str, field_name: str, logger: logging.Logger) -> None:
    try:
        storage.delete(name)
    except Exception:
        logger.exception("No se pudo eliminar el archivo del campo %s", field_name)


def delete_storage_file_after_commit(
    storage, name: str, field_name: str, logger: logging.Logger
) -> None:
    if name:
        transaction.on_commit(partial(_delete_file, storage, name, field_name, logger))


def delete_files_after_commit(instance, field_names, logger: logging.Logger) -> None:
    """Schedule file deletion after the row/cascade transaction really commits."""
    for field_name in field_names:
        file_field = getattr(instance, field_name)
        if file_field.name:
            delete_storage_file_after_commit(
                file_field.storage, file_field.name, field_name, logger
            )
