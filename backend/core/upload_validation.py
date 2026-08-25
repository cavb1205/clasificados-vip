"""Validación común para uploads antes de procesarlos o almacenarlos."""

from __future__ import annotations

from io import BytesIO

from PIL import Image, UnidentifiedImageError

IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
VIDEO_MIME_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
MAX_IMAGE_BYTES = 15 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
MAX_IMAGE_DIMENSION = 12_000


class UploadValidationError(ValueError):
    """El archivo no cumple los límites o no es un formato seguro."""


def _check_size(upload, max_bytes: int) -> None:
    if getattr(upload, "size", 0) > max_bytes:
        raise UploadValidationError(
            f"El archivo supera el máximo permitido de {max_bytes // (1024 * 1024)} MB."
        )


def validate_image_bytes(raw: bytes) -> None:
    """Comprueba formato, dimensiones y estructura antes de decodificar píxeles."""
    try:
        with Image.open(BytesIO(raw)) as image:
            width, height = image.size
            if (
                width <= 0
                or height <= 0
                or max(width, height) > MAX_IMAGE_DIMENSION
                or width * height > MAX_IMAGE_PIXELS
            ):
                raise UploadValidationError("La imagen supera las dimensiones permitidas.")
            image.verify()
    except UploadValidationError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning, UnidentifiedImageError, OSError) as exc:
        raise UploadValidationError("El archivo no es una imagen válida.") from exc


def validate_image_upload(upload, *, max_bytes: int = MAX_IMAGE_BYTES):
    _check_size(upload, max_bytes)
    content_type = getattr(upload, "content_type", "") or ""
    if content_type and content_type not in IMAGE_MIME_TYPES and content_type != "application/octet-stream":
        raise UploadValidationError("Solo se permiten imágenes JPEG, PNG o WebP.")
    raw = upload.read()
    upload.seek(0)
    validate_image_bytes(raw)
    return upload


def validate_video_upload(upload, *, max_bytes: int = MAX_VIDEO_BYTES):
    _check_size(upload, max_bytes)
    content_type = getattr(upload, "content_type", "") or ""
    if content_type and content_type not in VIDEO_MIME_TYPES and content_type != "application/octet-stream":
        raise UploadValidationError("Solo se permiten videos MP4, MOV o WebM.")
    return upload
