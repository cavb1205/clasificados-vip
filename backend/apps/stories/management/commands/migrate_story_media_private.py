"""Copia stories históricas de MEDIA_ROOT al storage privado."""

from django.conf import settings
from django.core.files.storage import FileSystemStorage, storages
from django.core.management.base import BaseCommand

from apps.stories.models import Story


class Command(BaseCommand):
    help = "Copia stories históricas al storage privado; use --delete-public después de verificar."

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

        for story in Story.objects.exclude(file="").iterator():
            name = story.file.name
            if target.exists(name):
                skipped += 1
                if delete_public and source.exists(name):
                    source.delete(name)
                continue

            if not source.exists(name):
                missing += 1
                self.stderr.write(f"No existe en MEDIA_ROOT: {name}")
                continue

            with source.open(name, "rb") as stream:
                target.save(name, stream, max_length=story.file.field.max_length)
            copied += 1
            if delete_public:
                source.delete(name)

        self.stdout.write(
            self.style.SUCCESS(
                f"Stories privadas: {copied} copiadas, {skipped} omitidas, {missing} faltantes."
            )
        )
