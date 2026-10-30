import pytest
from datetime import timedelta
from jose import jwt, ExpiredSignatureError, JWTError
from core.config import settings
from core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)


def test_password_hash_and_verify_success():
    raw_password = "SecurePassword@123"
    hashed = hash_password(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True


def test_password_verify_incorrect_password():
    raw_password = "SecurePassword@123"
    hashed = hash_password(raw_password)
    assert verify_password("WrongPassword@456", hashed) is False


def test_two_hashes_differ_due_to_salts():
    raw_password = "SecurePassword@123"
    hash_one = hash_password(raw_password)
    hash_two = hash_password(raw_password)
    assert hash_one != hash_two
    assert verify_password(raw_password, hash_one) is True
    assert verify_password(raw_password, hash_two) is True


def test_invalid_hash_safely_returns_false():
    assert verify_password("my_password", "not_a_valid_hash") is False
    assert verify_password("my_password", "") is False


def test_access_token_creation_and_decoding():
    payload = {"sub": "user-uuid-1234", "role": "admin"}
    token = create_access_token(payload)
    decoded = decode_token(token)

    assert decoded["sub"] == "user-uuid-1234"
    assert decoded["role"] == "admin"
    assert decoded["type"] == "access"
    assert "exp" in decoded


def test_refresh_token_creation_and_decoding():
    payload = {"sub": "user-uuid-1234"}
    token = create_refresh_token(payload)
    decoded = decode_token(token)

    assert decoded["sub"] == "user-uuid-1234"
    assert decoded["type"] == "refresh"
    assert "exp" in decoded


def test_token_types_distinguishable():
    access_token = create_access_token({"sub": "user-1"})
    refresh_token = create_refresh_token({"sub": "user-1"})

    assert decode_token(access_token)["type"] == "access"
    assert decode_token(refresh_token)["type"] == "refresh"


def test_expired_token_rejected():
    expired_delta = timedelta(seconds=-10)
    token = create_access_token({"sub": "user-1"}, expires_delta=expired_delta)

    with pytest.raises(ExpiredSignatureError):
        decode_token(token)


def test_invalid_signature_rejected():
    token = create_access_token({"sub": "user-1"})
    tampered_token = token[:-5] + "wrong"

    with pytest.raises(JWTError):
        decode_token(tampered_token)


def test_original_payload_not_mutated():
    original = {"sub": "user-1", "custom": "value"}
    original_copy = dict(original)

    _ = create_access_token(original)
    assert original == original_copy

    _ = create_refresh_token(original)
    assert original == original_copy
