"""Cifrado simétrico (Fernet) para documentos KYC en reposo.

Los bytes del archivo se cifran antes de escribirse al almacén privado y se
descifran solo en memoria al momento de servirlos a un admin autorizado.
"""

from django.conf import settings
from cryptography.fernet import Fernet


def _get_fernet() -> Fernet:
    key = settings.KYC_ENCRYPTION_KEY
    if not key:
        raise RuntimeError(
            "KYC_ENCRYPTION_KEY no está configurada. Genera una con "
            "`python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\"`."
        )
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_bytes(raw: bytes) -> bytes:
    return _get_fernet().encrypt(raw)


def decrypt_bytes(token: bytes) -> bytes:
    return _get_fernet().decrypt(token)
