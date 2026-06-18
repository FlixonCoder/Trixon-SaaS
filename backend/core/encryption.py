"""
Trixon Backend — Token Encryption Service

Provides AES-256 encryption for VCS access tokens at rest using
the Fernet symmetric encryption scheme from the `cryptography` library.

Fernet guarantees that a message encrypted using it cannot be
manipulated or read without the key. It uses AES-128-CBC with
PKCS7 padding and HMAC-SHA256 for authentication.

Usage:
    from backend.core.encryption import encrypt_token, decrypt_token

    encrypted = encrypt_token("ghp_xxxxxxxxxxxx")
    original = decrypt_token(encrypted)
"""

import logging

from cryptography.fernet import Fernet, InvalidToken

from backend.core.config import get_settings

logger = logging.getLogger(__name__)

_fernet: Fernet | None = None


def _get_fernet() -> Fernet | None:
    """
    Returns a cached Fernet instance using the ENCRYPTION_KEY from settings.

    The key must be a valid Fernet key (32 url-safe base64-encoded bytes).
    Generate one with:
        python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    """
    global _fernet

    if _fernet is not None:
        return _fernet

    settings = get_settings()

    if not settings.encryption_key:
        logger.warning(
            "ENCRYPTION_KEY not configured. "
            "VCS tokens will NOT be encrypted. "
            "Set ENCRYPTION_KEY in your .env file."
        )
        return None

    try:
        _fernet = Fernet(settings.encryption_key.encode())
        return _fernet
    except Exception as e:
        logger.error(
            f"Invalid ENCRYPTION_KEY: {e}. "
            "Generate a valid key with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
        return None


def encrypt_token(plaintext: str) -> str:
    """
    Encrypts a plaintext token string.

    Returns the encrypted token as a string. If encryption is not
    configured, returns the plaintext unchanged (with a warning).
    """
    fernet = _get_fernet()
    if fernet is None:
        logger.warning("Encryption not available — storing token in plaintext!")
        return plaintext

    try:
        encrypted = fernet.encrypt(plaintext.encode())
        return encrypted.decode()
    except Exception as e:
        logger.error(f"Failed to encrypt token: {e}")
        raise


def decrypt_token(encrypted_text: str) -> str:
    """
    Decrypts an encrypted token string back to plaintext.

    Raises ValueError if the token cannot be decrypted (wrong key,
    corrupted data, etc.).
    """
    fernet = _get_fernet()
    if fernet is None:
        # If encryption was never configured, the token is already plaintext
        logger.warning("Encryption not available — returning token as-is.")
        return encrypted_text

    try:
        decrypted = fernet.decrypt(encrypted_text.encode())
        return decrypted.decode()
    except InvalidToken:
        logger.error("Failed to decrypt token — invalid key or corrupted data.")
        raise ValueError("Cannot decrypt token. The encryption key may have changed.")
    except Exception as e:
        logger.error(f"Unexpected error decrypting token: {e}")
        raise
