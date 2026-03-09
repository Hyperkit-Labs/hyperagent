"""
KMS-backed envelope encryption for BYOK at-rest. When LLM_KEY_KMS_KEY_ARN is set,
the Orchestrator never sees the master key: it only requests KMS to encrypt/decrypt
a one-time Data Encryption Key (DEK). User LLM keys are encrypted locally with the DEK.

Flow:
  Save: Generate DEK -> encrypt LLM keys with DEK (AES-GCM) -> KMS.encrypt(DEK) -> store [encrypted_DEK, payload].
  Load: Fetch blob -> KMS.decrypt(encrypted_DEK) -> decrypt payload with DEK -> return keys.

Stored format (single string in DB): JSON with v=1, data_key (base64 KMS blob), payload (base64), nonce (base64).
"""

from __future__ import annotations

import base64
import json
import logging
import os
import secrets

logger = logging.getLogger(__name__)

KMS_KEY_ARN_ENV = "LLM_KEY_KMS_KEY_ARN"
ENCRYPTION_CONTEXT = {"App": "Orchestrator", "Type": "BYOK"}

# AES-GCM: 256-bit key, 96-bit nonce
DEK_BYTES = 32
NONCE_BYTES = 12


def _is_kms_configured() -> bool:
    return bool(os.environ.get(KMS_KEY_ARN_ENV))


def _get_kms_client():
    try:
        import boto3

        return boto3.client("kms")
    except ImportError:
        logger.warning("[byok] boto3 not installed; KMS backend unavailable")
        return None


def _local_encrypt(dek: bytes, plaintext: bytes) -> tuple[bytes, bytes]:
    """Encrypt plaintext with DEK using AES-256-GCM. Returns (nonce, ciphertext_with_tag)."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = secrets.token_bytes(NONCE_BYTES)
    aes = AESGCM(dek)
    ct = aes.encrypt(nonce, plaintext, None)
    return nonce, ct


def _local_decrypt(dek: bytes, nonce: bytes, ciphertext: bytes) -> bytes:
    """Decrypt ciphertext (includes 16-byte tag) with DEK and nonce."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    aes = AESGCM(dek)
    return aes.decrypt(nonce, ciphertext, None)


def _is_envelope_blob(ciphertext: str) -> bool:
    """True if the stored value is KMS envelope format (v1 JSON with data_key)."""
    if not ciphertext or len(ciphertext) < 20:
        return False
    stripped = ciphertext.strip()
    if not stripped.startswith("{"):
        return False
    try:
        obj = json.loads(stripped)
        return (
            isinstance(obj, dict)
            and obj.get("v") == 1
            and "data_key" in obj
            and "payload" in obj
        )
    except (json.JSONDecodeError, TypeError):
        return False


def encrypt_llm_keys_kms(raw_keys: dict[str, str]) -> str:
    """
    Envelope encrypt: generate DEK, encrypt payload with DEK, wrap DEK with KMS.
    Returns a single JSON string to store in DB (v, data_key, payload, nonce).
    """
    key_arn = os.environ.get(KMS_KEY_ARN_ENV)
    if not key_arn:
        raise ValueError(f"{KMS_KEY_ARN_ENV} must be set to use KMS encrypt")
    client = _get_kms_client()
    if not client:
        raise RuntimeError("KMS client unavailable (install boto3)")

    plaintext = json.dumps(raw_keys, sort_keys=True).encode("utf-8")
    dek = secrets.token_bytes(DEK_BYTES)
    nonce, ciphertext = _local_encrypt(dek, plaintext)

    try:
        resp = client.encrypt(
            KeyId=key_arn,
            Plaintext=dek,
            EncryptionContext=ENCRYPTION_CONTEXT,
        )
        encrypted_dek = resp.get("CiphertextBlob")
        if not encrypted_dek:
            raise RuntimeError("KMS encrypt returned no CiphertextBlob")
    except Exception as e:
        logger.warning("[byok] KMS encrypt (DEK wrap) failed: %s", e)
        raise

    blob = {
        "v": 1,
        "data_key": base64.b64encode(encrypted_dek).decode("ascii"),
        "payload": base64.b64encode(ciphertext).decode("ascii"),
        "nonce": base64.b64encode(nonce).decode("ascii"),
    }
    return json.dumps(blob, sort_keys=True)


def decrypt_llm_keys_kms(ciphertext: str) -> dict[str, str]:
    """
    Envelope decrypt: parse blob, call KMS.decrypt(encrypted_DEK), decrypt payload with DEK.
    Supports stored format {"v":1,"data_key":"...","payload":"...","nonce":"..."}.
    """
    client = _get_kms_client()
    if not client:
        raise RuntimeError("KMS client unavailable (install boto3)")

    if not _is_envelope_blob(ciphertext):
        raise ValueError(
            "Stored value is not KMS envelope format (v1); re-save keys with KMS enabled"
        )

    obj = json.loads(ciphertext.strip())
    data_key_b64 = obj.get("data_key")
    payload_b64 = obj.get("payload")
    nonce_b64 = obj.get("nonce")
    if not data_key_b64 or not payload_b64 or not nonce_b64:
        raise ValueError("KMS envelope blob missing data_key, payload, or nonce")

    encrypted_dek = base64.b64decode(data_key_b64.encode("ascii"))
    try:
        resp = client.decrypt(
            CiphertextBlob=encrypted_dek,
            EncryptionContext=ENCRYPTION_CONTEXT,
        )
        dek = resp.get("Plaintext")
        if not dek or len(dek) != DEK_BYTES:
            raise RuntimeError("KMS decrypt returned invalid DEK")
    except Exception as e:
        logger.warning("[byok] KMS decrypt (DEK unwrap) failed: %s", e)
        raise

    try:
        payload_bytes = base64.b64decode(payload_b64.encode("ascii"))
        nonce_bytes = base64.b64decode(nonce_b64.encode("ascii"))
        plaintext = _local_decrypt(dek, nonce_bytes, payload_bytes)
        return json.loads(plaintext.decode("utf-8"))
    finally:
        # Shorten exposure: DEK is about to go out of scope; we cannot zero bytes in Python
        # but we avoid keeping references
        del dek
