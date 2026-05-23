from io import BytesIO

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from PIL import Image

from apps.profiles.models import ModelProfile
from core.image_processing import has_gps_metadata, process_image
from .models import MediaContent

User = get_user_model()


def _image_with_exif_gps() -> bytes:
    """Genera un JPEG con tag EXIF 'Software' y coordenadas GPS."""
    img = Image.new("RGB", (2000, 1200), (10, 120, 200))
    exif = img.getexif()
    exif[0x0131] = "TestCamera 1.0"  # Software
    gps = exif.get_ifd(0x8825)
    gps[1] = "S"
    gps[2] = (33.0, 27.0, 0.0)  # Santiago aprox.
    buffer = BytesIO()
    img.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


class ImageProcessingTests(TestCase):
    def setUp(self):
        self.raw = _image_with_exif_gps()

    def test_input_actually_has_gps(self):
        self.assertTrue(has_gps_metadata(self.raw))

    def test_pipeline_strips_all_exif_and_gps(self):
        result = process_image(self.raw)
        processed = result.read()
        self.assertFalse(has_gps_metadata(processed))
        with Image.open(BytesIO(processed)) as img:
            self.assertEqual(img.format, "JPEG")
            self.assertEqual(len(img.getexif()), 0)  # sin metadatos

    def test_pipeline_resizes_and_compresses(self):
        result = process_image(self.raw)
        processed = result.read()
        with Image.open(BytesIO(processed)) as img:
            self.assertLessEqual(max(img.size), 1600)
        # La compresión debe reducir el tamaño respecto al original sin comprimir.
        self.assertLess(len(processed), len(self.raw))


@override_settings(MAX_PHOTOS_PER_PROFILE=2, MAX_VIDEOS_PER_PROFILE=1)
class MediaLimitTests(TestCase):
    def setUp(self):
        user = User.objects.create_user(
            username="m", email="m@example.com", password="x", role="model"
        )
        self.profile = ModelProfile.objects.create(user=user, stage_name="Luna", age=25)

    def _make_photo(self):
        from django.core.files.base import ContentFile

        media = MediaContent(profile=self.profile, media_type="photo")
        media.file.save("p.jpg", ContentFile(b"data"), save=False)
        media.full_clean()
        media.save()

    def test_photo_limit_enforced(self):
        from django.core.exceptions import ValidationError

        self._make_photo()
        self._make_photo()
        with self.assertRaises(ValidationError):
            self._make_photo()  # tercera supera el límite de 2
