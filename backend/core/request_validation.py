from collections.abc import Mapping

from rest_framework.exceptions import ValidationError


def request_text(data, key, *, default="", max_length=2000, strip=True):
    """Reject structured payloads instead of raising AttributeError/HTTP 500."""
    if not isinstance(data, Mapping):
        raise ValidationError({"detail": "El cuerpo de la solicitud debe ser un objeto."})
    value = data.get(key, default)
    if value is None:
        value = default
    if not isinstance(value, str):
        raise ValidationError({key: "El valor debe ser texto."})
    if len(value) > max_length:
        raise ValidationError({key: f"El valor no puede superar {max_length} caracteres."})
    return value.strip() if strip else value
