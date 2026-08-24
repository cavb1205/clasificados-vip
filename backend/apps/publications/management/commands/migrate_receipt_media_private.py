"""Copia comprobantes históricos de MEDIA_ROOT al storage privado.

La migración de esquema protege los comprobantes nuevos, pero no mueve archivos
que ya existían en el volumen público. Este comando permite hacer esa migración
de forma explícita y reversible hasta el momento de borrar el origen público.
"""

from django.conf import settings
from django.core.files.storage import FileSystemStorage, storages
from django.core.management.base import BaseCommand

from apps.publications.models import PaymentReceipt
from apps.rooms.models import RoomReceipt


class Command(BaseCommand):
    help = "Copia comprobantes históricos al storage privado; use --delete-public después de verificar."

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

        for model in (PaymentReceipt, RoomReceipt):
            for receipt in model.objects.exclude(image="").iterator():
                name = receipt.image.name
                if target.exists(name):
                    skipped += 1
                    # Permite repetir el comando después de una ejecución con
                    # --delete-public sin convertir los archivos ya migrados
                    # en falsos faltantes.
                    if delete_public and source.exists(name):
                        source.delete(name)
                    continue

                if not source.exists(name):
                    missing += 1
                    self.stderr.write(f"No existe en MEDIA_ROOT: {name}")
                    continue

                with source.open(name, "rb") as stream:
                    target.save(name, stream, max_length=receipt.image.field.max_length)
                copied += 1

                if delete_public:
                    source.delete(name)

        self.stdout.write(
            self.style.SUCCESS(
                f"Comprobantes privados: {copied} copiados, {skipped} omitidos, {missing} faltantes."
            )
        )
