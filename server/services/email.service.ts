import nodemailer from "nodemailer";

export const emailService = {
  async sendTemporaryPassword(params: {
    toEmail: string;
    name: string;
    temporaryPassword: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { toEmail, name, temporaryPassword } = params;

    const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
    const smtpPort = Number(process.env.SMTP_PORT) || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass) {
      console.warn(
        "⚠️ SMTP credentials not set in environment variables. Skipped sending email to:",
        toEmail,
      );
      return { success: false, error: "SMTP credentials not configured" };
    }

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

      const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const loginUrl = `${appUrl}/login`;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #2563eb; letter-spacing: 0.05em;">Internal Team Task Board</span>
            <h2 style="color: #0f172a; margin: 8px 0 0 0; font-size: 22px;">Your Temporary Login Password</h2>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Hello <strong>${name}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Your account has been created by your administrator. Use this temporary password to log in:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b;">Temporary Password:</p>
            <div style="font-family: monospace; font-size: 20px; font-weight: 700; letter-spacing: 1.5px; color: #0f172a; background: #e2e8f0; padding: 8px 12px; border-radius: 6px; display: inline-block;">
              ${temporaryPassword}
            </div>
          </div>

          <p style="color: #b45309; font-size: 13px; background-color: #fef3c7; border: 1px solid #fde68a; padding: 10px 14px; border-radius: 6px; margin-bottom: 24px;">
            🔒 <strong>Important:</strong> For security, you will be prompted to update this temporary password upon your first sign in.
          </p>

          <div style="margin-top: 10px;">
            <a href="${loginUrl}" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
              Sign In to Task Board
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            If you did not request this invitation, please contact your workspace administrator.
          </p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Task Board" <${smtpUser}>`,
        to: toEmail,
        subject: "Your Temporary Login Password - Team Task Board",
        text: `Hello ${name},\n\nYour temporary password to log in is: ${temporaryPassword}\n\nPlease visit ${loginUrl} to log in and set your new password.`,
        html: htmlContent,
      });

      console.log(
        `[SMTP] Temporary password successfully sent to ${toEmail}: ${info.messageId}`,
      );
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[SMTP Error] Failed to send email to", toEmail, err);
      return { success: false, error: (err as Error).message };
    }
  },
};
