import uuid
import pytest
from pydantic import ValidationError
from schemas.auth_schema import (
    LoginRequest,
    LoginResponse,
    UserSummary,
    ChangePasswordRequest,
    RefreshTokenRequest,
)


def test_valid_login_request():
    """1. A valid login request is accepted."""
    req = LoginRequest(email="admin@teamboard.com", password="Admin@123")
    assert req.email == "admin@teamboard.com"
    assert req.password == "Admin@123"


def test_invalid_email_rejected():
    """2. An invalid email is rejected."""
    with pytest.raises(ValidationError):
        LoginRequest(email="not-an-email", password="Admin@123")


def test_empty_password_rejected():
    """3. An empty password is rejected."""
    with pytest.raises(ValidationError):
        LoginRequest(email="admin@teamboard.com", password="")


def test_valid_login_response_construction():
    """4. A valid login response can be constructed with token fields."""
    res = LoginResponse(
        access_token="sample-access-token",
        refresh_token="sample-refresh-token",
        token_type="bearer",
        access_token_expires_in=900,
        refresh_token_expires_in=604800,
    )
    assert res.access_token == "sample-access-token"
    assert res.refresh_token == "sample-refresh-token"
    assert res.token_type == "bearer"
    assert res.access_token_expires_in == 900
    assert res.refresh_token_expires_in == 604800


def test_user_summary_does_not_expose_password():
    """5. The user response schema does not expose hashed_password or plaintext password."""
    fields = UserSummary.model_fields.keys()
    assert "hashed_password" not in fields
    assert "password" not in fields


def test_empty_passwords_rejected_in_change_password():
    """6. Empty current, new, or confirmation password values are rejected."""
    with pytest.raises(ValidationError):
        ChangePasswordRequest(
            currentPassword="",
            newPassword="NewPassword@123",
        )
    with pytest.raises(ValidationError):
        ChangePasswordRequest(
            currentPassword="OldPassword@123",
            newPassword="",
        )


def test_valid_change_password_request_accepted():
    """A valid password-change request with only current and new password is accepted."""
    req = ChangePasswordRequest(
        currentPassword="OldPassword@123",
        newPassword="NewPassword@456",
    )
    assert req.current_password == "OldPassword@123"
    assert req.new_password == "NewPassword@456"


def test_empty_refresh_token_rejected():
    """9. An empty refresh token is rejected."""
    with pytest.raises(ValidationError):
        RefreshTokenRequest(refresh_token="")


def test_valid_refresh_token_request_accepted():
    """10. A valid refresh-token request is accepted."""
    req = RefreshTokenRequest(refresh_token="valid.jwt.token")
    assert req.refresh_token == "valid.jwt.token"


def test_schema_serialization_field_names():
    """11. The schemas serialize using the exact expected API field names."""
    uid = uuid.uuid4()
    user = UserSummary(
        id=uid,
        name="Admin",
        email="admin@teamboard.com",
        role="admin",
        status="active",
        requires_password_change=True,
    )
    user_dict = user.model_dump(by_alias=True)
    assert "requiresPasswordChange" in user_dict
    assert user_dict["requiresPasswordChange"] is True

    res = LoginResponse(
        access_token="access-123",
        refresh_token="refresh-123",
        token_type="Bearer",
    )
    res_dict = res.model_dump(by_alias=True)
    assert "accessToken" in res_dict
    assert "refreshToken" in res_dict
    assert "tokenType" in res_dict
