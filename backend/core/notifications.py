"""Notificaciones por email al admin cuando hay trabajo pendiente.

En desarrollo el `EMAIL_BACKEND` es console (los emails salen por stdout del
`runserver`). En producción se configura SMTP real via env. Usamos
`mail_admins` para que respete la lista `settings.ADMINS` y agregue prefijo
`[Django]` automáticamente.
"""

from django.core.mail import mail_admins


def notify_admins(subject: str, message: str) -> None:
    # fail_silently=True evita que un fallo de SMTP rompa la request.
    mail_admins(subject, message, fail_silently=True)
