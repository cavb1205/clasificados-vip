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
import threading
import uuid

from django.core.files.base import ContentFile

logger = logging.getLogger(__name__)

# Fuente para el watermark (se instala con fonts-dejavu-core en el Dockerfile).
_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
WATERMARK_TEXT = "PortalVip"


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


def add_video_watermark(data: bytes, ext: str = ".mp4") -> "ContentFile | None":
    """Re-codifica el video con el watermark de marca (abajo a la derecha) y lo
    escala a máx 1280px de alto. Devuelve None si ffmpeg falla o no está. Es
    LENTO (re-encode) → llamar en segundo plano, no en el request."""
    if shutil.which("ffmpeg") is None:
        return None
    stem = f"video-{uuid.uuid4().hex}"
    font = _FONT if os.path.exists(_FONT) else None
    drawtext = (
        (f"fontfile={font}:" if font else "")
        + f"text='{WATERMARK_TEXT}':fontcolor=white@0.55:fontsize=h/22:"
        "x=w-tw-20:y=h-th-20:shadowcolor=black@0.5:shadowx=1:shadowy=1"
    )
    vf = "scale=-2:min(1280\\,ih)," + "drawtext=" + drawtext
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, f"in{ext}")
        dst = os.path.join(tmp, "out.mp4")
        with open(src, "wb") as f:
            f.write(data)
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", src, "-map_metadata", "-1", "-vf", vf,
                 "-c:v", "libx264", "-preset", "veryfast", "-crf", "24",
                 "-c:a", "aac", "-movflags", "+faststart", dst],
                check=True, capture_output=True, timeout=300,
            )
            with open(dst, "rb") as f:
                return ContentFile(f.read(), name=f"{stem}.mp4")
        except Exception as e:  # noqa: BLE001
            logger.warning("add_video_watermark falló: %s", e)
            return None


def watermark_file_async(model, object_pk: int) -> None:
    """Aplica watermark a un modelo con `file` en segundo plano."""

    def _run():
        from django.core.files.storage import default_storage
        from django.db import connection

        try:
            item = model.objects.filter(pk=object_pk).first()
            if not item or not item.file:
                return
            item.file.open("rb")
            data = item.file.read()
            item.file.close()
            ext = os.path.splitext(item.file.name)[1] or ".mp4"
            wm = add_video_watermark(data, ext)
            if wm:
                old = item.file.name
                item.file.save(os.path.basename(wm.name), wm, save=True)
                if old and old != item.file.name:
                    try:
                        default_storage.delete(old)
                    except Exception:
                        pass
        except Exception as e:  # noqa: BLE001
            logger.warning("watermark_media_async falló: %s", e)
        finally:
            connection.close()

    threading.Thread(target=_run, daemon=True).start()


def watermark_media_async(media_pk: int) -> None:
    """Aplica watermark a un MediaContent sin bloquear la subida."""
    from apps.media_content.models import MediaContent
    watermark_file_async(MediaContent, media_pk)


def watermark_story_async(story_pk: int) -> None:
    """Aplica watermark a una Story de video sin bloquear la subida."""
    from apps.stories.models import Story
    watermark_file_async(Story, story_pk)
