import uuid
from datetime import timedelta
import pytest
from httpx import AsyncClient

from core.config import settings
from core.security import create_access_token, create_refresh_token, decode_token


@pytest.mark.asyncio
async def test_login_stores_refresh_token_in_redis_with_jti_and_ttl(client: AsyncClient, mock_redis):
    """
    Step 5 Requirement:
    - Successful login returns access and refresh token.
    - Redis key structure: refresh_token:<user_id>:<jti>.
    - Value is 'active'.
    - Redis TTL matches 7 days (604,800s).
    """
    login_payload = {
        "email": "admin@teamboard.com",
        "password": "Admin@123",
    }
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json=login_payload,
    )
    assert response.status_code == 200
    data = response.json()
    refresh_token = data["refreshToken"]

    # Decode refresh token and inspect claims
    payload = decode_token(refresh_token)
    assert payload["type"] == "refresh"
    assert "sub" in payload
    assert "jti" in payload
    user_id = payload["sub"]
    jti = payload["jti"]

    # Check Redis key structure
    expected_redis_key = f"refresh_token:{user_id}:{jti}"
    assert expected_redis_key in mock_redis.store
    assert mock_redis.store[expected_redis_key] == "active"

    # Check TTL matches refresh token expiration (7 days = 604,800 seconds)
    assert expected_redis_key in mock_redis.ttls
    assert mock_redis.ttls[expected_redis_key] == settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


@pytest.mark.asyncio
async def test_refresh_token_validation_and_rotation(client: AsyncClient, mock_redis):
    """
    Step 5 Requirement:
    - Successful refresh returns a new access token and rotated refresh token.
    - Old refresh token is invalidated in Redis (prevents reuse).
    - New refresh token is active in Redis under its new jti.
    """
    # 1. Login
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    assert login_res.status_code == 200
    old_refresh_token = login_res.json()["refreshToken"]
    old_payload = decode_token(old_refresh_token)
    old_key = f"refresh_token:{old_payload['sub']}:{old_payload['jti']}"
    assert old_key in mock_redis.store

    # 2. Refresh
    refresh_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": old_refresh_token},
    )
    assert refresh_res.status_code == 200
    refresh_data = refresh_res.json()
    assert "accessToken" in refresh_data
    assert "refreshToken" in refresh_data
    new_refresh_token = refresh_data["refreshToken"]

    new_payload = decode_token(new_refresh_token)
    new_key = f"refresh_token:{new_payload['sub']}:{new_payload['jti']}"

    # Verify old key was invalidated/deleted
    assert old_key not in mock_redis.store
    # Verify new key is stored and active
    assert new_key in mock_redis.store
    assert mock_redis.store[new_key] == "active"
    assert mock_redis.ttls[new_key] == settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


@pytest.mark.asyncio
async def test_refresh_token_reuse_rejected(client: AsyncClient, mock_redis):
    """
    Step 5 Requirement:
    - Attempting to reuse an old refresh token that was rotated returns 401 Unauthorized.
    """
    # 1. Login
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    old_refresh_token = login_res.json()["refreshToken"]

    # 2. First refresh (succeeds)
    res1 = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": old_refresh_token},
    )
    assert res1.status_code == 200

    # 3. Second refresh with the same old token (MUST FAIL with 401)
    res2 = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": old_refresh_token},
    )
    assert res2.status_code == 401
    assert "revoked" in str(res2.json()).lower() or "invalid" in str(res2.json()).lower()


@pytest.mark.asyncio
async def test_invalid_refresh_token_rejected(client: AsyncClient):
    """
    Step 5 Requirement:
    - Malformed or tampered token returns 401 Unauthorized.
    """
    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": "malformed.jwt.token.string"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_expired_refresh_token_rejected(client: AsyncClient, mock_redis):
    """
    Step 5 Requirement:
    - Expired refresh token returns 401 Unauthorized.
    """
    # Create expired token
    user_id = "550e8400-e29b-41d4-a716-446655440000"
    jti = "expired-token-jti"
    expired_token = create_refresh_token(
        data={"sub": user_id},
        expires_delta=timedelta(seconds=-10),
        jti=jti,
    )

    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": expired_token},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_access_token_used_instead_of_refresh_token_rejected(client: AsyncClient):
    """
    Step 5 Requirement:
    - Passing an access token to /auth/refresh returns 401 Unauthorized (type must be 'refresh').
    """
    access_token = create_access_token(data={"sub": "550e8400-e29b-41d4-a716-446655440000"})
    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": access_token},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_logout_revokes_specific_refresh_token(client: AsyncClient, mock_redis):
    """
    Step 5 Requirement:
    - POST /auth/logout with refreshToken invalidates that specific token in Redis.
    - POST /auth/logout blacklists the Bearer access token.
    - Subsequent refresh with the revoked token returns 401.
    """
    # 1. Login
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    access_token = login_res.json()["accessToken"]
    refresh_token = login_res.json()["refreshToken"]

    payload = decode_token(refresh_token)
    redis_key = f"refresh_token:{payload['sub']}:{payload['jti']}"
    assert redis_key in mock_redis.store

    # 2. Logout providing both Bearer token and refreshToken in body
    logout_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/logout",
        headers={"Authorization": f"Bearer {access_token}"},
        json={"refreshToken": refresh_token},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully"

    # Verify refresh token is deleted from Redis
    assert redis_key not in mock_redis.store
    # Verify access token is blacklisted in Redis
    assert f"blacklist:{access_token}" in mock_redis.store

    # 3. Attempting to use the revoked refresh token returns 401
    refresh_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert refresh_res.status_code == 401

