import email.message
from email.message import EmailMessage
import aiosmtplib
import httpx

from core.config import settings
from core.logger import logger
from core.retry import retry_with_backoff


def render_invitation_html(
    name: str,
    signup_url: str | None = None,
    login_url: str | None = None,
    temp_password: str | None = None,
) -> str:
    """Generate a clean, responsive HTML email template for new user invitations."""
    action_url = signup_url or login_url or f"{settings.FRONTEND_URL.rstrip('/')}/signup"
    if "localhost" in action_url:
        action_url = action_url.replace("http://localhost:3000", "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app")

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
      You have been invited to join the <strong>Team Hub</strong> workspace. Please activate your account and choose your password by clicking the button below:
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="{action_url}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
        Set Up Your Account &rarr;
      </a>
    </div>

    <p style="font-size: 13px; line-height: 20px; color: #94a3b8;">
      Or copy and paste this activation link directly into your browser:<br>
      <a href="{action_url}" style="color: #818cf8; word-break: break-all;">{action_url}</a>
    </p>

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
    if "localhost" in action_url:
        action_url = action_url.replace("http://localhost:3000", "https://capstone-git-main-abhishek-ganeshwadis-projects.vercel.app")

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


@retry_with_backoff(max_retries=3, initial_delay=1.0, backoff_factor=2.0)
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

    # 1. Dispatch email (passwords and sensitive credentials are not logged)
    logger.info("==================================================")
    logger.info(" [INVITATION EMAIL DISPATCH] Recipient: %s <%s>", name, email)
    if signup_url:
        logger.info(" Signup / Activation URL: %s", signup_url)
    logger.info("==================================================")

    # Check if SMTP credentials are provided
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(
            "SMTP credentials not configured (SMTP_USER/SMTP_PASSWORD empty). Invitation email simulated for: %s",
            email,
        )
        return True

    sent = False
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USER,
            password=settings.SMTP_PASSWORD.replace(" ", ""),
            start_tls=(settings.SMTP_PORT == 587),
            timeout=5.0,
        )
        logger.info("Invitation email sent successfully via direct SMTP to: %s", email)
        sent = True
    except Exception as exc:
        logger.warning(
            "Direct SMTP connection failed or blocked (%s). Attempting HTTPS relay to frontend API...",
            exc,
        )

    # 2. Fallback to HTTPS relay on port 443 (guaranteed to bypass Render free tier SMTP blocks)
    if not sent and signup_url:
        try:
            relay_url = f"{settings.FRONTEND_URL.rstrip('/')}/api/send-invitation"
            logger.info("Relaying email dispatch via HTTPS to: %s", relay_url)
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    relay_url,
                    json={
                        "toEmail": email,
                        "name": name,
                        "signupUrl": signup_url,
                        "tempPassword": temp_password,
                    },
                )
                if res.status_code in (200, 201):
                    logger.info("Invitation email sent successfully via HTTPS relay to: %s", email)
                    sent = True
                else:
                    logger.error("HTTPS relay returned status %s: %s", res.status_code, res.text)
        except Exception as exc2:
            logger.error("HTTPS relay failed: %s", exc2)

    return sent
