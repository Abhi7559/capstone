from datetime import datetime, timedelta, timezone
from typing import Any
import bcrypt
from jose import jwt
from core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    """Hash plaintext password using bcrypt."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def get_password_hash(password: str) -> str:
    """Alias for hash_password."""
    return hash_password(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plaintext password against stored bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except Exception:
        return False


def create_access_token(data: dict[str, Any] | str, expires_delta: timedelta | None = None) -> str:
    """Create short-lived JWT access token with user claims."""
    to_encode = data.copy() if isinstance(data, dict) else {"sub": str(data)}
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(
    data: dict[str, Any] | str,
    expires_delta: timedelta | None = None,
    jti: str | None = None,
) -> str:
    """Create longer-lived JWT refresh token with user claims and a unique jti."""
    import uuid
    to_encode = data.copy() if isinstance(data, dict) else {"sub": str(data)}
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    )
    token_jti = jti or to_encode.get("jti") or str(uuid.uuid4())
    to_encode.update({"exp": expire, "type": "refresh", "jti": token_jti})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_invitation_token(data: dict[str, Any] | str, expires_delta: timedelta | None = None) -> str:
    """Create secure signed invitation token with 3-day expiry for account activation/signup."""
    to_encode = data.copy() if isinstance(data, dict) else {"sub": str(data)}
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=3))
    to_encode.update({"exp": expire, "type": "invitation"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decode and verify JWT token signature and expiration."""
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
