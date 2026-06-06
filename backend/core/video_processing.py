"""Limpieza de metadata de los videos del muro (privacidad de la modelo).

Los videos suelen llevar metadata global (modelo de cámara, fecha, y a veces
GPS) que podría exponer la ubicación. Con ffmpeg remuxeamos el archivo
descartando toda la metadata (`-map_metadata -1`) sin re-codificar (`-c copy`),
así es rápido y sin pérdida de calidad.

Si ffmpeg no está disponible o falla, devolvemos el archivo original (no rompe
la subida); en producción ffmpeg se instala en el Dockerfile.
"""

import logging
import os
import shutil
import subprocess
import tempfile
import uuid

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)


def strip_video_metadata(upload) -> ContentFile:
    """Devuelve un ContentFile del video sin metadata. `upload` es un archivo
    subido (tiene .read() y .name)."""
    name = getattr(upload, "name", "video.mp4")
    ext = os.path.splitext(name)[1].lower() or ".mp4"
    stem = f"video-{uuid.uuid4().hex}"

    upload.seek(0)
    data = upload.read()

    if shutil.which("ffmpeg") is None:
        logger.warning("ffmpeg no disponible: el video se guarda sin limpiar metadata.")
        return ContentFile(data, name=f"{stem}{ext}")

    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, f"in{ext}")
        dst = os.path.join(tmp, f"out{ext}")
        with open(src, "wb") as f:
            f.write(data)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", src, "-map_metadata", "-1",
                 "-c", "copy", "-movflags", "+faststart", dst],
                check=True, capture_output=True, timeout=120,
            )
            with open(dst, "rb") as f:
                return ContentFile(f.read(), name=f"{stem}{ext}")
        except Exception as e:  # noqa: BLE001 — nunca romper la subida por esto
            logger.warning("strip_video_metadata falló (%s); se guarda el original.", e)
            return ContentFile(data, name=f"{stem}{ext}")
