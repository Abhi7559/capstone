import pytest
from unittest.mock import AsyncMock, patch
from core.config import settings
from services.email_service import (
    create_invitation_message,
    render_invitation_html,
    send_invitation_email,
)


def test_invitation_message_headers_and_recipient():
    """1. The email is created with the correct recipient and sender."""
    msg = create_invitation_message(
        recipient_email="newmember@example.com",
        name="Alice Member",
        temp_password="TempPassword@123",
    )
    assert msg["To"] == "newmember@example.com"
    assert f"<{settings.EMAILS_FROM_EMAIL}>" in msg["From"]
    assert "Welcome to Team Hub" in msg["Subject"]


def test_invitation_html_contains_required_fields():
    """2, 3, 4, 5. The email contains name, login URL, temp password, and reminder to change."""
    login_url = f"{settings.FRONTEND_URL.rstrip('/')}/login"
    temp_pass = "TempSecretPass999!"
    name = "Bob Smith"

    html = render_invitation_html(
        name=name,
        login_url=login_url,
        temp_password=temp_pass,
    )

    # 2. Contains member name
    assert name in html
    # 3. Contains login URL
    assert login_url in html
    # 4. Contains temporary password
    assert temp_pass in html
    # 5. Includes a reminder to change password
    assert "change this temporary password" in html


@pytest.mark.asyncio
async def test_send_invitation_email_configured_smtp_called():
    """6. The SMTP send function is called with the expected message and configuration."""
    with patch("services.email_service.settings") as mock_settings:
        mock_settings.SMTP_HOST = "smtp.testserver.com"
        mock_settings.SMTP_PORT = 587
        mock_settings.SMTP_USER = "smtp_user@test.com"
        mock_settings.SMTP_PASSWORD = "secret_smtp_password"
        mock_settings.EMAILS_FROM_EMAIL = "noreply@teamboard.com"
        mock_settings.EMAILS_FROM_NAME = "Team Hub"
        mock_settings.FRONTEND_URL = "http://localhost:3000"

        with patch("services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = ({}, "250 OK")

            result = await send_invitation_email(
                email="charlie@example.com",
                name="Charlie",
                temp_password="Password123!",
            )

            assert result is True
            assert mock_send.called
            # Verify hostname and port passed to aiosmtplib.send
            _, kwargs = mock_send.call_args
            assert kwargs["hostname"] == "smtp.testserver.com"
            assert kwargs["port"] == 587
            assert kwargs["username"] == "smtp_user@test.com"
            assert kwargs["password"] == "secret_smtp_password"
            assert kwargs["start_tls"] is True


@pytest.mark.asyncio
async def test_send_invitation_email_handles_smtp_error():
    """7. SMTP delivery errors are handled according to project conventions without crashing."""
    import aiosmtplib

    with patch("services.email_service.settings") as mock_settings:
        mock_settings.SMTP_HOST = "smtp.testserver.com"
        mock_settings.SMTP_PORT = 587
        mock_settings.SMTP_USER = "smtp_user@test.com"
        mock_settings.SMTP_PASSWORD = "secret_smtp_password"
        mock_settings.EMAILS_FROM_EMAIL = "noreply@teamboard.com"
        mock_settings.EMAILS_FROM_NAME = "Team Hub"
        mock_settings.FRONTEND_URL = "http://localhost:3000"

        with patch("services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            mock_send.side_effect = aiosmtplib.SMTPException("Connection timed out")

            result = await send_invitation_email(
                email="failing@example.com",
                name="Failing User",
                temp_password="Password123!",
            )

            # Function should gracefully return False instead of raising an unhandled exception
            assert result is False


@pytest.mark.asyncio
async def test_unconfigured_smtp_simulates_in_development():
    """8. Missing SMTP configuration gracefully simulates email dispatch in dev mode."""
    with patch("services.email_service.settings") as mock_settings:
        # Simulate unconfigured SMTP credentials (e.g. fresh local dev clone)
        mock_settings.SMTP_USER = ""
        mock_settings.SMTP_PASSWORD = ""
        mock_settings.EMAILS_FROM_EMAIL = "noreply@teamboard.com"
        mock_settings.EMAILS_FROM_NAME = "Team Hub"
        mock_settings.FRONTEND_URL = "http://localhost:3000"

        with patch("services.email_service.aiosmtplib.send", new_callable=AsyncMock) as mock_send:
            result = await send_invitation_email(
                email="localdev@example.com",
                name="Local Dev",
                temp_password="Password123!",
            )

            assert result is True
            # aiosmtplib.send should not be invoked when credentials are not configured
            assert not mock_send.called
