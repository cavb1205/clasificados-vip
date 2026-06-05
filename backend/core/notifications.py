"""Notificaciones por email al admin cuando hay trabajo pendiente.

En desarrollo el `EMAIL_BACKEND` es console (los emails salen por stdout del
`runserver`). En producción se configura SMTP real via env. Usamos
`mail_admins` para que respete la lista `settings.ADMINS` y agregue prefijo
`[Django]` automáticamente.

IMPORTANTE: con SMTP real, enviar un correo es I/O de red que puede TARDAR o
COLGARSE (host que acepta la conexión pero no responde). Si se hace dentro del
request (p. ej. al subir un comprobante), la petición se bloquea hasta el
timeout del worker → el cliente ve "failed to fetch". Por eso, con backend SMTP
el envío se hace en un hilo en segundo plano (fire-and-forget); en dev/tests
(console/locmem, instantáneo) se envía sincrónico para no romper los tests.
"""

import threading

from django.conf import settings
from django.core.mail import mail_admins


def _safe_send(subject: str, message: str) -> None:
    try:
        # fail_silently=True evita que un fallo de SMTP rompa nada.
        mail_admins(subject, message, fail_silently=True)
    except Exception:
        pass


def notify_admins(subject: str, message: str) -> None:
    if "smtp" in settings.EMAIL_BACKEND:
        # Prod: no bloquear la request si el SMTP tarda/se cuelga.
        threading.Thread(
            target=_safe_send, args=(subject, message), daemon=True
        ).start()
    else:
        # Dev/tests (console/locmem): instantáneo y observable en el outbox.
        _safe_send(subject, message)
