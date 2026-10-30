import pytest
from httpx import AsyncClient
from core.config import settings


@pytest.mark.asyncio
async def test_admin_login_success(client: AsyncClient):
    """1. Successful login returns access token, refresh token, and user summary."""
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
    assert "accessToken" in data or "access_token" in data
    assert "refreshToken" in data or "refresh_token" in data
    token_type = data.get("tokenType") or data.get("token_type")
    assert token_type.lower() == "bearer"
    access_expires = data.get("accessTokenExpiresIn") or data.get("access_token_expires_in")
    assert access_expires == 900
    refresh_expires = data.get("refreshTokenExpiresIn") or data.get("refresh_token_expires_in")
    assert refresh_expires == 604800
    # Clean OAuth2 / REST architecture: User profile is queried via GET /auth/me
    token = data.get("accessToken") or data.get("access_token")
    me_res = await client.get(
        f"{settings.API_V1_PREFIX}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    user = me_res.json()
    assert user["email"] == "admin@teamboard.com"
    assert user["name"] == "System Admin"
    assert user["role"] == "admin"
    assert user["status"] == "active"
    assert "password" not in user
    assert "hashedPassword" not in user


@pytest.mark.asyncio
async def test_get_current_user_me(client: AsyncClient):
    """Verify GET /auth/me returns the profile and avatar of the authenticated user."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    token = login_res.json()["accessToken"]

    me_res = await client.get(
        f"{settings.API_V1_PREFIX}/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == "admin@teamboard.com"
    assert me_data["name"] == "System Admin"
    assert me_data["role"] == "admin"
    assert "avatar" in me_data
    assert "dicebear.com" in me_data["avatar"]


@pytest.mark.asyncio
async def test_admin_login_invalid_password(client: AsyncClient):
    """2. Invalid credentials return 401 Unauthorized."""
    login_payload = {
        "email": "admin@teamboard.com",
        "password": "WrongPassword!456",
    }
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json=login_payload,
    )
    assert response.status_code == 401
    data = response.json()
    assert "details" in data
    assert data["msg"] == "Unauthorized"


@pytest.mark.asyncio
async def test_login_extra_fields_forbidden(client: AsyncClient):
    """3. Extra fields in payload are rejected with 422 Unprocessable Entity."""
    payload_with_extra_field = {
        "email": "admin@teamboard.com",
        "password": "Admin@123",
        "abji": "askmknd",
    }
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json=payload_with_extra_field,
    )
    assert response.status_code == 422
    data = response.json()
    assert "details" in data
    assert any(err.get("loc") == ["body", "abji"] for err in data["details"])


@pytest.mark.asyncio
async def test_change_password_endpoint(client: AsyncClient):
    """4. PATCH /auth/change-password rotates password and clears required flag."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    token = login_res.json()["accessToken"]

    # Test PATCH /auth/change-password
    change_res = await client.patch(
        f"{settings.API_V1_PREFIX}/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "currentPassword": "Admin@123",
            "newPassword": "NewAdminPassword@2026",
            "confirmPassword": "NewAdminPassword@2026",
        },
    )
    assert change_res.status_code == 200
    data = change_res.json()
    assert data["message"] == "Password updated successfully"
    assert data["user"]["requiresPasswordChange"] is False

    # Rotate back to original Admin@123 via PATCH so other tests remain isolated
    await client.patch(
        f"{settings.API_V1_PREFIX}/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "currentPassword": "NewAdminPassword@2026",
            "newPassword": "Admin@123",
            "confirmPassword": "Admin@123",
        },
    )


@pytest.mark.asyncio
async def test_refresh_token_endpoint(client: AsyncClient):
    """5. POST /auth/refresh returns a fresh access token."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    refresh_token = login_res.json()["refreshToken"]

    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": refresh_token},
    )
    assert res.status_code == 200
    assert "accessToken" in res.json()
    assert res.json()["tokenType"] == "Bearer"


@pytest.mark.asyncio
async def test_logout_endpoint(client: AsyncClient, mock_redis):
    """6. POST /auth/logout blacklists token in Redis."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    token = login_res.json()["accessToken"]

    logout_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200
    assert logout_res.json()["message"] == "Logged out successfully"
    assert f"blacklist:{token}" in mock_redis.store


@pytest.mark.asyncio
async def test_member_invite_endpoint(client: AsyncClient):
    """7. POST /members/invite creates member and dispatches background email."""
    login_res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "admin@teamboard.com", "password": "Admin@123"},
    )
    token = login_res.json()["accessToken"]

    invite_payload = {
        "name": "Sarah Connor",
        "email": "sarah.connor@teamboard.com",
        "designation": "DevOps Engineer",
        "joiningDate": "2026-11-01",
    }
    invite_res = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {token}"},
        json=invite_payload,
    )
    assert invite_res.status_code == 201
    data = invite_res.json()
    assert data["message"] == "Invitation sent successfully"
    assert data["member"]["email"] == "sarah.connor@teamboard.com"
    assert data["member"]["role"] == "member"
    assert data["member"]["requiresPasswordChange"] is True
    assert "invitationToken" in data or "invitation_token" in data
    assert "signupUrl" in data or "signup_url" in data
    assert "temporaryPassword" not in data
    assert "temporary_password" not in data

    # Duplicate invite returns 409 Conflict
    dup_res = await client.post(
        f"{settings.API_V1_PREFIX}/members/invite",
        headers={"Authorization": f"Bearer {token}"},
        json=invite_payload,
    )
    assert dup_res.status_code == 409


@pytest.mark.asyncio
async def test_login_unknown_email_returns_401(client: AsyncClient):
    """8. Login with non-existent email returns 401 Unauthorized safely."""
    response = await client.post(
        f"{settings.API_V1_PREFIX}/auth/login",
        json={"email": "nonexistent_user@teamboard.com", "password": "AnyPassword@123"},
    )
    assert response.status_code == 401
    data = response.json()
    assert data["msg"] == "Unauthorized"
    assert "Invalid email or password" in str(data.get("detail", "")) or "Invalid email or password" in str(data.get("details", ""))


@pytest.mark.asyncio
async def test_refresh_token_invalid_or_expired(client: AsyncClient):
    """9. POST /auth/refresh with invalid token returns 401."""
    res = await client.post(
        f"{settings.API_V1_PREFIX}/auth/refresh",
        json={"refreshToken": "invalid.jwt.token.here"},
    )
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_protected_route_missing_or_invalid_access_token(client: AsyncClient):
    """10. Protected routes reject missing or invalid access tokens with 401."""
    # Missing token
    res_missing = await client.get(f"{settings.API_V1_PREFIX}/auth/me")
    assert res_missing.status_code == 401

    # Invalid token format
    res_invalid = await client.get(
        f"{settings.API_V1_PREFIX}/auth/me",
        headers={"Authorization": "Bearer malformed.token.value"},
    )
    assert res_invalid.status_code == 401
