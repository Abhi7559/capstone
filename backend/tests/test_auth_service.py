import uuid
import pytest
from core.security import hash_password, verify_password, create_refresh_token
from dao.user_dao import user_dao
from services.auth_service import auth_service
from schemas.auth_schema import LoginRequest
from exceptions.domain import UnauthorizedException
import database.engine
from models.user import User

def get_test_session():
    return database.engine.async_session_factory()


# ============================================================================
# User DAO Tests
# ============================================================================

@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_get_by_email():
    """1. Finding a user by an existing email returns the user object."""
    async with get_test_session() as session:
        user = await user_dao.get_by_email(session, "admin@teamboard.com")
        assert user is not None
        assert user.email == "admin@teamboard.com"
        assert user.role == "admin"


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_get_by_email_not_found():
    """2. Returning None for an unknown email."""
    async with get_test_session() as session:
        user = await user_dao.get_by_email(session, "nonexistent_email_123@teamboard.com")
        assert user is None


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_get_by_id():
    """3. Finding a user by their UUID."""
    async with get_test_session() as session:
        admin = await user_dao.get_by_email(session, "admin@teamboard.com")
        assert admin is not None

        user_by_id = await user_dao.get_by_id(session, admin.id)
        assert user_by_id is not None
        assert user_by_id.id == admin.id


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_get_by_id_not_found():
    """4. Returning None for an unknown user ID."""
    async with get_test_session() as session:
        random_uuid = uuid.uuid4()
        user = await user_dao.get_by_id(session, random_uuid)
        assert user is None


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_create_user():
    """5. Creating a user successfully."""
    unique_email = f"dao_test_{uuid.uuid4().hex[:6]}@teamboard.com"
    async with get_test_session() as session:
        new_user = await user_dao.create_user(
            session,
            {
                "name": "DAO Test User",
                "email": unique_email,
                "hashed_password": hash_password("Password@123"),
                "role": "member",
                "status": "active",
                "designation": "Software Tester",
            },
        )
        assert new_user.id is not None
        assert new_user.email == unique_email
        assert new_user.designation == "Software Tester"


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_update_password():
    """6. Updating a password hash and clearing requires_password_change."""
    unique_email = f"pw_update_{uuid.uuid4().hex[:6]}@teamboard.com"
    async with get_test_session() as session:
        user = await user_dao.create_user(
            session,
            {
                "name": "Password User",
                "email": unique_email,
                "hashed_password": hash_password("OldPassword@123"),
                "role": "member",
                "status": "active",
                "requires_password_change": True,
            },
        )
        assert user.requires_password_change is True

        new_hash = hash_password("NewPassword@456")
        updated_user = await user_dao.update_password(session, user, new_hash)
        assert verify_password("NewPassword@456", updated_user.hashed_password) is True
        assert updated_user.requires_password_change is False


@pytest.mark.asyncio(loop_scope="session")
async def test_user_dao_update_user():
    """7. Updating user fields without unintentionally changing other fields."""
    unique_email = f"field_update_{uuid.uuid4().hex[:6]}@teamboard.com"
    async with get_test_session() as session:
        user = await user_dao.create_user(
            session,
            {
                "name": "Original Name",
                "email": unique_email,
                "hashed_password": hash_password("Pass@123"),
                "role": "member",
                "designation": "Junior Engineer",
            },
        )

        updated_user = await user_dao.update_user(
            session, user, {"name": "Updated Name", "designation": "Senior Engineer"}
        )
        assert updated_user.name == "Updated Name"
        assert updated_user.designation == "Senior Engineer"
        # Email and role remain untouched
        assert updated_user.email == unique_email
        assert updated_user.role == "member"


# ============================================================================
# Authentication Service Tests
# ============================================================================

@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_successful_login():
    """1 & 4. Successful login returns access token, refresh token, and user summary."""
    async with get_test_session() as session:
        login_req = LoginRequest(email="admin@teamboard.com", password="Admin@123")
        response = await auth_service.authenticate_user(session, login_req)

        assert response.access_token is not None
        assert response.refresh_token is not None
        assert response.token_type.lower() == "bearer"
        assert response.access_token_expires_in == 900
        assert response.refresh_token_expires_in == 604800


@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_unknown_email_rejected():
    """2. Login fails with UnauthorizedException when email does not exist."""
    async with get_test_session() as session:
        login_req = LoginRequest(email="nobody@teamboard.com", password="Password@123")
        with pytest.raises(UnauthorizedException, match="Invalid email or password"):
            await auth_service.authenticate_user(session, login_req)


@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_incorrect_password_rejected():
    """3. Login fails with UnauthorizedException when password is incorrect."""
    async with get_test_session() as session:
        login_req = LoginRequest(email="admin@teamboard.com", password="WrongPassword!999")
        with pytest.raises(UnauthorizedException, match="Invalid email or password"):
            await auth_service.authenticate_user(session, login_req)


@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_inactive_user_rejected():
    """5. Inactive users are rejected upon login."""
    unique_email = f"inactive_{uuid.uuid4().hex[:6]}@teamboard.com"
    async with get_test_session() as session:
        await user_dao.create_user(
            session,
            {
                "name": "Inactive User",
                "email": unique_email,
                "hashed_password": hash_password("Pass@123"),
                "status": "invited",  # not active
            },
        )

        login_req = LoginRequest(email=unique_email, password="Pass@123")
        with pytest.raises(UnauthorizedException, match="inactive or pending activation"):
            await auth_service.authenticate_user(session, login_req)


@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_change_password():
    """Change password validates current password, hashes new password, and clears flag."""
    unique_email = f"service_pw_{uuid.uuid4().hex[:6]}@teamboard.com"
    async with get_test_session() as session:
        user = await user_dao.create_user(
            session,
            {
                "name": "Change PW User",
                "email": unique_email,
                "hashed_password": hash_password("OldSecret@123"),
                "requires_password_change": True,
            },
        )

        # Wrong current password fails
        with pytest.raises(UnauthorizedException, match="Current password is incorrect"):
            await auth_service.change_password(
                session, user, "IncorrectCurrentPass", "NewSecret@456"
            )

        # Correct current password succeeds
        summary = await auth_service.change_password(
            session, user, "OldSecret@123", "NewSecret@456"
        )
        assert summary.requires_password_change is False

        # Login with new password works
        login_req = LoginRequest(email=unique_email, password="NewSecret@456")
        res = await auth_service.authenticate_user(session, login_req)
        assert res.access_token is not None


@pytest.mark.asyncio(loop_scope="session")
async def test_auth_service_refresh_token():
    """Refresh token issues a fresh access token for an active user."""
    async with get_test_session() as session:
        admin = await user_dao.get_by_email(session, "admin@teamboard.com")
        assert admin is not None

        refresh_jwt = create_refresh_token(data={"sub": str(admin.id)})
        token_res = await auth_service.refresh_access_token(session, refresh_jwt)

        assert "access_token" in token_res
        assert token_res["token_type"] == "Bearer"
