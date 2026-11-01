import uuid
import pytest
from datetime import timedelta
from httpx import AsyncClient, ASGITransport
from fastapi import APIRouter, Depends, FastAPI
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from main import app
from core.config import settings
from core.security import create_access_token, create_refresh_token, hash_password
from dependencies.auth import get_current_user, get_current_user_allow_pending, require_role
from dependencies.db import get_db
from models.user import User

# Ephemeral test routes mounted on the app for dependency testing
test_router = APIRouter(prefix="/test-auth-deps", tags=["Testing"])


@test_router.get("/protected")
async def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": "success", "user_id": str(current_user.id)}


@test_router.get("/change-password-flow")
async def change_password_route(current_user: User = Depends(get_current_user_allow_pending)):
    return {"message": "password_change_allowed", "user_id": str(current_user.id)}


@test_router.get("/admin-only")
async def admin_only_route(current_user: User = Depends(require_role("admin"))):
    return {"message": "admin_granted", "user_id": str(current_user.id)}


@test_router.get("/member-or-admin")
async def member_or_admin_route(current_user: User = Depends(require_role("member", "admin"))):
    return {"message": "access_granted", "user_id": str(current_user.id)}


app.include_router(test_router)


# Fixture: helper to generate authorization headers
def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio(loop_scope="session")
async def test_missing_auth_header_rejected():
    """1. Missing Authorization header is rejected with 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/test-auth-deps/protected")
        assert response.status_code == 401
        data = response.json()
        assert data["status_code"] == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_malformed_bearer_header_rejected():
    """2. Malformed bearer credentials are rejected with 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Missing 'Bearer ' prefix
        response = await client.get(
            "/test-auth-deps/protected",
            headers={"Authorization": "Token somethinginvalid"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_valid_access_token_identifies_database_user():
    """3. Valid access token identifies the correct database user."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # First login as admin to get real user id
        login_res = await client.post(
            f"{settings.API_V1_PREFIX}/auth/login",
            json={"email": "admin@teamboard.com", "password": "Admin@123"},
        )
        token = login_res.json()["accessToken"]

        response = await client.get("/test-auth-deps/protected", headers=auth_header(token))
        assert response.status_code == 200
        assert response.json()["message"] == "success"


@pytest.mark.asyncio(loop_scope="session")
async def test_invalid_token_rejected():
    """4. Invalid token is rejected with 401."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/test-auth-deps/protected",
            headers=auth_header("invalid.jwt.token"),
        )
        assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_expired_token_rejected():
    """5. Expired token is rejected with 401."""
    expired_token = create_access_token(
        data={"sub": str(uuid.uuid4())},
        expires_delta=timedelta(seconds=-10),
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/test-auth-deps/protected",
            headers=auth_header(expired_token),
        )
        assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_refresh_token_rejected_as_access_token():
    """6. Refresh token is rejected when an access token is required."""
    refresh_token = create_refresh_token(data={"sub": str(uuid.uuid4())})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/test-auth-deps/protected",
            headers=auth_header(refresh_token),
        )
        assert response.status_code == 401
        err_msg = response.json().get("detail") or response.json().get("details", "")
        assert "not an access token" in err_msg


@pytest.mark.asyncio(loop_scope="session")
async def test_invalid_signature_token_rejected():
    """7. Token with an invalid signature is rejected."""
    # Token signed with forged secret key
    from jose import jwt
    forged_token = jwt.encode(
        {"sub": str(uuid.uuid4()), "type": "access"},
        "wrong-secret-key-that-does-not-match",
        algorithm="HS256",
    )
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/test-auth-deps/protected",
            headers=auth_header(forged_token),
        )
        assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_unknown_user_id_rejected():
    """8. Token containing an unknown user ID is rejected with 401."""
    random_uuid = str(uuid.uuid4())
    token = create_access_token(data={"sub": random_uuid})
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(
            "/test-auth-deps/protected",
            headers=auth_header(token),
        )
        assert response.status_code == 401
        err_msg = response.json().get("detail") or response.json().get("details", "")
        assert err_msg == "User does not exist."


@pytest.mark.asyncio(loop_scope="session")
async def test_password_change_flow_isolation():
    """10 & 11. User with requires_password_change=True cannot access protected routes, but CAN access password change flow."""
    # Create a temporary user with requires_password_change=True in the database
    temp_user_id = uuid.uuid4()
    async with app.state.async_session() if hasattr(app.state, "async_session") else AsyncSession() as session:
        pass  # will use dependency session below

    from database.engine import async_session_factory
    async with async_session_factory() as session:
        temp_user = User(
            id=temp_user_id,
            name="Pending User",
            email=f"pending_{temp_user_id.hex[:6]}@teamboard.com",
            hashed_password=hash_password("TempPass@123"),
            role="member",
            status="active",
            requires_password_change=True,
        )
        session.add(temp_user)
        await session.commit()

    token = create_access_token(data={"sub": str(temp_user_id)})

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 10. Ordinary protected route must be BLOCKED with 403
        blocked_res = await client.get("/test-auth-deps/protected", headers=auth_header(token))
        assert blocked_res.status_code == 403
        blocked_err = blocked_res.json().get("detail") or blocked_res.json().get("details", "")
        assert "Password change required" in blocked_err

        # 11. Password-change route must be ALLOWED with 200
        allowed_res = await client.get("/test-auth-deps/change-password-flow", headers=auth_header(token))
        assert allowed_res.status_code == 200
        assert allowed_res.json()["message"] == "password_change_allowed"


@pytest.mark.asyncio(loop_scope="session")
async def test_require_role_admin_and_member_enforcement():
    """12, 13, 14. Admin access, member forbidden from admin, and allowed role checks."""
    from database.engine import async_session_factory
    admin_id = uuid.uuid4()
    member_id = uuid.uuid4()

    async with async_session_factory() as session:
        admin_user = User(
            id=admin_id,
            name="Test Admin",
            email=f"admin_{admin_id.hex[:6]}@teamboard.com",
            hashed_password=hash_password("Pass@123"),
            role="admin",
            status="active",
            requires_password_change=False,
        )
        member_user = User(
            id=member_id,
            name="Test Member",
            email=f"member_{member_id.hex[:6]}@teamboard.com",
            hashed_password=hash_password("Pass@123"),
            role="member",
            status="active",
            requires_password_change=False,
        )
        session.add(admin_user)
        session.add(member_user)
        await session.commit()

    admin_token = create_access_token(data={"sub": str(admin_id)})
    member_token = create_access_token(data={"sub": str(member_id)})

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 12. Admin can access admin-only dependency
            res_admin = await client.get("/test-auth-deps/admin-only", headers=auth_header(admin_token))
            assert res_admin.status_code == 200
            assert res_admin.json()["message"] == "admin_granted"

            # 13. Member is rejected from admin-only dependency with 403
            res_member_blocked = await client.get("/test-auth-deps/admin-only", headers=auth_header(member_token))
            assert res_member_blocked.status_code == 403
            member_blocked_err = res_member_blocked.json().get("detail") or res_member_blocked.json().get("details", "")
            assert "does not have permission" in member_blocked_err

            # 14. Member can access member-or-admin route
            res_member_allowed = await client.get("/test-auth-deps/member-or-admin", headers=auth_header(member_token))
            assert res_member_allowed.status_code == 200
            assert res_member_allowed.json()["message"] == "access_granted"
    finally:
        async with async_session_factory() as session:
            await session.execute(
                delete(User).where(User.id.in_([admin_id, member_id]))
            )
            await session.commit()
