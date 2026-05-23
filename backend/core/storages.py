"""Backends de almacenamiento.

Hoy todo es local (FileSystemStorage). El día que se migre a S3/R2 basta con
cambiar el `BACKEND` en `settings.STORAGES` por `storages.backends.s3.S3Storage`
(django-storages): los modelos y vistas no cambian porque siempre usan la
abstracción `FieldFile` / `storages[...]`.
"""

from django.conf import settings
from django.core.files.storage import FileSystemStorage


class PrivateMediaStorage(FileSystemStorage):
    """Almacén separado y privado para documentos sensibles (KYC).

    No se sirve desde `MEDIA_URL`; el acceso pasa siempre por una vista
    protegida que descifra y registra auditoría. Por eso `base_url=None`.
    """

    def __init__(self, *args, **kwargs):
        kwargs.setdefault("location", str(settings.PRIVATE_MEDIA_ROOT))
        kwargs.setdefault("base_url", None)
        super().__init__(*args, **kwargs)
