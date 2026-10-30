import email.message
from email.message import EmailMessage
import aiosmtplib

from core.config import settings
from core.logger import logger


def render_invitation_html(
    name: str,
    signup_url: str | None = None,
    login_url: str | None = None,
    temp_password: str | None = None,
) -> str:
    """Generate a clean, responsive HTML email template for new user invitations."""
    action_url = signup_url or login_url or f"{settings.FRONTEND_URL.rstrip('/')}/signup"
    
    password_box = ""
    if temp_password:
        password_box = f"""
    <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 18px 22px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Your Temporary Password</p>
      <code style="font-family: 'Courier New', Courier, monospace; font-size: 18px; color: #38bdf8; font-weight: 700; letter-spacing: 1px;">{temp_password}</code>
    </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Team Hub</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 40px 20px;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 36px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);">
    <div style="text-align: center; margin-bottom: 28px;">
      <h1 style="color: #6366f1; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Team Hub</h1>
      <p style="color: #94a3b8; font-size: 14px; margin-top: 6px;">Workspace & Task Management Platform</p>
    </div>

    <p style="font-size: 16px; line-height: 24px; color: #e2e8f0; margin-top: 0;">
      Hello <strong>{name}</strong>,
    </p>

    <p style="font-size: 15px; line-height: 24px; color: #cbd5e1;">
      You have been invited to join the <strong>Team Hub</strong> workspace. Please activate your account by setting up your password below.
    </p>

    {password_box}

    <div style="background-color: #3b82f61a; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 24px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #93c5fd; line-height: 20px;">
        {f"<strong>Important:</strong> You will be prompted to change this temporary password immediately after your first login." if temp_password else "Click the button below to open your secure signup page, choose your password, and start collaborating."}
      </p>
    </div>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{action_url}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
        Set Up Your Account &rarr;
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0 20px 0;">

    <p style="font-size: 12px; color: #64748b; line-height: 18px; margin: 0; text-align: center;">
      If you were not expecting this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>"""


def create_invitation_message(
    recipient_email: str,
    name: str,
    signup_url: str | None = None,
    temp_password: str | None = None,
) -> EmailMessage:
    """Build the multipart EmailMessage with subject, recipient, sender, and HTML template."""
    action_url = signup_url or f"{settings.FRONTEND_URL.rstrip('/')}/signup"

    message = EmailMessage()
    message["Subject"] = "Welcome to Team Hub — Activate Your Account"
    message["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
    message["To"] = recipient_email

    plain_text = (
        f"Hello {name},\n\n"
        f"You have been invited to join Team Hub.\n\n"
        f"Please activate your account and choose your password at:\n"
        f"{action_url}\n\n"
        f"Welcome aboard!"
    )
    message.set_content(plain_text)

    # HTML formatted email body
    html_content = render_invitation_html(
        name=name, signup_url=action_url, temp_password=temp_password
    )
    message.add_alternative(html_content, subtype="html")

    return message


async def send_invitation_email(
    email: str,
    name: str,
    signup_url: str | None = None,
    temp_password: str | None = None,
) -> bool:
    """
    Send an invitation email asynchronously using aiosmtplib.
    
    If SMTP_USER or SMTP_PASSWORD is not configured, logs the dispatch event
    gracefully to avoid crashing local development environments.
    """
    message = create_invitation_message(
        recipient_email=email,
        name=name,
        signup_url=signup_url,
        temp_password=temp_password,
    )

    # Log invitation link clearly for easy testing and debugging
    logger.info("==================================================")
    logger.info(" [INVITATION EMAIL DISPATCH] Recipient: %s <%s>", name, email)
    if signup_url:
        logger.info(" Signup / Activation URL: %s", signup_url)
    if temp_password:
        logger.info(" Temporary Password: %s", temp_password)
    logger.info("==================================================")

    # Check if SMTP credentials are provided
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(
            "SMTP credentials not configured (SMTP_USER/SMTP_PASSWORD empty). Invitation email simulated for: %s",
            email,
        )
        return True

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD,
            start_tls=(settings.SMTP_PORT == 587),
        )
        logger.info("Invitation email sent successfully to: %s", email)
        return True
    except Exception as exc:
        logger.error(
            "Failed to send invitation email to %s: %s",
            email,
            str(exc),
        )
        return False
