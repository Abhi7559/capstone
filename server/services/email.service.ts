import nodemailer from "nodemailer";

export const emailService = {
  async sendTemporaryPassword(params: {
    toEmail: string;
    name: string;
    temporaryPassword: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const { toEmail, name } = params;

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
      const signupUrl = `${appUrl}/signup?email=${encodeURIComponent(toEmail)}`;

      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 13px; font-weight: 700; text-transform: uppercase; color: #2563eb; letter-spacing: 0.05em;">Internal Team Task Board</span>
            <h2 style="color: #0f172a; margin: 8px 0 0 0; font-size: 22px;">Welcome to Team Hub — Activate Your Account</h2>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.6;">
            Hello <strong>${name}</strong>,
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            You have been invited to join the <strong>Team Hub</strong> workspace. Click the button below to set up your password and complete your account setup:
          </p>

          <div style="margin: 25px 0;">
            <a href="${signupUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; display: inline-block;">
              Set Up Your Password & Activate Account &rarr;
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this link in your browser:<br />
            <a href="${signupUrl}" style="color: #2563eb;">${signupUrl}</a>
          </p>

          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0 20px 0;" />
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            If you did not expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `;

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Task Board" <${smtpUser}>`,
        to: toEmail,
        subject: "Welcome to Team Hub — Activate Your Account",
        text: `Hello ${name},\n\nYou have been invited to join Team Hub.\n\nPlease visit the following link to set your password and activate your account:\n${signupUrl}`,
        html: htmlContent,
      });

      console.log(
        `[SMTP] Invitation link successfully sent to ${toEmail}: ${info.messageId}`,
      );
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error("[SMTP Error] Failed to send email to", toEmail, err);
      return { success: false, error: (err as Error).message };
    }
  },
};
