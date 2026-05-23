from django.contrib.auth.models import AbstractUser
from django.db import models


class CustomUser(AbstractUser):
    """Usuario base con rol. El email es obligatorio y único (login por email)."""

    class Role(models.TextChoices):
        MODEL = "model", "Modelo"
        CLIENT = "client", "Cliente"
        ADMIN = "admin", "Administrador"

    email = models.EmailField("correo electrónico", unique=True)
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.CLIENT)
    email_verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"
