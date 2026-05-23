"""Pipeline de procesamiento de imágenes con Pillow.

Aplica, en orden, las tres garantías de privacidad/optimización exigidas:
1. Elimina TODOS los metadatos EXIF (incluidas coordenadas GPS).
2. Aplica una marca de agua genérica.
3. Comprime y normaliza a JPEG optimizado.

El EXIF se elimina implícitamente al reconstruir la imagen pixel a pixel en una
nueva instancia `Image` (no se copia el diccionario `info`/`exif`).
"""

from __future__ import annotations

from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageDraw, ImageFont

JPEG_QUALITY = 82
MAX_DIMENSION = 1600  # lado máximo en px tras redimensionar
WATERMARK_TEXT = "clasificados.vip"


def _strip_exif(image: Image.Image) -> Image.Image:
    """Devuelve una copia sin metadatos: nuevo objeto con solo los píxeles."""
    clean = Image.new(image.mode, image.size)
    clean.putdata(list(image.getdata()))
    return clean


def _apply_watermark(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    overlay = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype("Arial.ttf", max(16, rgba.width // 22))
    except OSError:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    margin = max(8, rgba.width // 60)
    pos = (rgba.width - text_w - margin, rgba.height - text_h - margin * 2)
    draw.text(pos, WATERMARK_TEXT, fill=(255, 255, 255, 160), font=font)

    return Image.alpha_composite(rgba, overlay).convert("RGB")


def process_image(raw: bytes, *, filename_stem: str = "image") -> ContentFile:
    """Procesa bytes de imagen y devuelve un ContentFile JPEG listo para guardar."""
    with Image.open(BytesIO(raw)) as opened:
        opened.load()
        image = opened.convert("RGB")

    image = _strip_exif(image)

    if max(image.size) > MAX_DIMENSION:
        image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

    image = _apply_watermark(image)

    buffer = BytesIO()
    # Sin parámetro `exif=`: el JPEG resultante no contiene metadatos.
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    buffer.seek(0)
    return ContentFile(buffer.read(), name=f"{filename_stem}.jpg")


def has_gps_metadata(raw: bytes) -> bool:
    """Helper para tests: True si los bytes contienen tags GPS EXIF."""
    with Image.open(BytesIO(raw)) as opened:
        exif = opened.getexif()
        # 0x8825 = IFD de GPS.
        return 0x8825 in exif
