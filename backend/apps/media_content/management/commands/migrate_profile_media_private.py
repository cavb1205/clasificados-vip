"""Copia avatars y multimedia históricas de MEDIA_ROOT al storage privado."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage, storages
from django.core.management.base import BaseCommand

from apps.media_content.models import MediaContent
from apps.profiles.models import ModelProfile


class Command(BaseCommand):
    help = (
        "Copia avatars y multimedia históricas al storage privado; "
        "use --delete-public después de verificar."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--delete-public",
            action="store_true",
            help="Borra el archivo público después de copiarlo correctamente.",
        )

    def handle(self, *args, **options):
        source = FileSystemStorage(location=settings.MEDIA_ROOT)
        target = storages["private"]
        delete_public = options["delete_public"]
        copied = skipped = missing = 0

        for queryset, field_name, label in (
            (ModelProfile.objects.exclude(avatar=""), "avatar", "Avatar"),
            (MediaContent.objects.exclude(file=""), "file", "Multimedia"),
        ):
            for obj in queryset.iterator():
                file_field = getattr(obj, field_name)
                name = file_field.name
                if target.exists(name):
                    skipped += 1
                    if delete_public and source.exists(name):
                        source.delete(name)
                    continue

                if not source.exists(name):
                    missing += 1
                    self.stderr.write(f"{label} no existe en MEDIA_ROOT: {name}")
                    continue

                with source.open(name, "rb") as stream:
                    target.save(name, stream, max_length=file_field.field.max_length)
                copied += 1
                if delete_public:
                    source.delete(name)

        self.stdout.write(
            self.style.SUCCESS(
                f"Avatars/multimedia privados: {copied} copiados, "
                f"{skipped} omitidos, {missing} faltantes."
            )
        )
