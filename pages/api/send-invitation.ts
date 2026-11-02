import type { NextApiRequest, NextApiResponse } from "next";
import nodemailer from "nodemailer";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { toEmail, name, signupUrl } = req.body || {};

  if (!toEmail || !signupUrl) {
    return res.status(400).json({
      success: false,
      message: "toEmail and signupUrl are required.",
    });
  }

  const recipientName = name || "Team Member";
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER || "abhishekbganeshwadi@gmail.com";
  const smtpPass = (
    process.env.SMTP_PASSWORD ||
    process.env.SMTP_PASS ||
    "csxbilgmdnqxkgud"
  ).replace(/\s+/g, "");

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    const htmlContent = `<!DOCTYPE html>
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
      Hello <strong>${recipientName}</strong>,
    </p>

    <p style="font-size: 15px; line-height: 24px; color: #cbd5e1;">
      You have been invited to join the <strong>Team Hub</strong> workspace. Please activate your account and choose your password by clicking the button below:
    </p>

    <div style="text-align: center; margin: 32px 0;">
      <a href="${signupUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);">
        Set Up Your Account &rarr;
      </a>
    </div>

    <p style="font-size: 13px; line-height: 20px; color: #94a3b8;">
      Or copy and paste this activation link directly into your browser:<br>
      <a href="${signupUrl}" style="color: #818cf8; word-break: break-all;">${signupUrl}</a>
    </p>

    <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0 20px 0;">

    <p style="font-size: 12px; color: #64748b; line-height: 18px; margin: 0; text-align: center;">
      If you were not expecting this invitation, you can safely ignore this email.
    </p>
  </div>
</body>
</html>`;

    const info = await transporter.sendMail({
      from: `"Team Hub" <${smtpUser}>`,
      to: toEmail,
      subject: "Welcome to Team Hub — Activate Your Account",
      text: `Hello ${recipientName},\n\nYou have been invited to join Team Hub.\n\nPlease visit the following link to activate your account and set your password:\n${signupUrl}\n\nWelcome aboard!`,
      html: htmlContent,
    });

    console.log(`[API /send-invitation] Email successfully dispatched to ${toEmail}: ${info.messageId}`);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      message: `Invitation email sent successfully to ${toEmail}`,
    });
  } catch (error) {
    console.error("[API /send-invitation Error]", error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || "Failed to send invitation email",
    });
  }
}
