"""Condiciones contratadas y validación de comprobantes privados."""

from rest_framework import serializers

from .image_processing import process_image
from .upload_validation import UploadValidationError, validate_image_upload


def snapshot_plan(plan):
    if plan is None:
        return {"duration_days": 30, "includes_featured": False, "price": None}
    return {
        "id": plan.pk,
        "name": plan.name,
        "price": plan.price,
        "duration_days": plan.duration_days,
        "includes_featured": plan.includes_featured,
        "max_listings": plan.max_listings,
    }


def clean_receipt_image(upload):
    try:
        validate_image_upload(upload)
        # No sobreimprimir una marca sobre los datos bancarios del comprobante.
        return process_image(upload.read(), filename_stem="receipt", watermark=False)
    except UploadValidationError as exc:
        raise serializers.ValidationError(str(exc)) from exc
