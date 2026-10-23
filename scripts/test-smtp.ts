import fs from "node:fs";
import path from "node:path";

// Simple env loader without external dependencies
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...vals] = trimmed.split("=");
      const val = vals.join("=").replace(/^["']|["']$/g, "").trim();
      process.env[key.trim()] = val;
    }
  }
}

import { emailService } from "@/server/services/email.service";

async function main() {
  const targetEmail = process.argv[2] || process.env.SMTP_USER;

  console.log("=== Testing SMTP Email Delivery ===");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_PORT:", process.env.SMTP_PORT);
  console.log("SMTP_USER:", process.env.SMTP_USER || "<NOT SET>");
  console.log("Target Email:", targetEmail || "<NOT SET>");

  if (!process.env.SMTP_USER) {
    console.error("\n❌ Error: SMTP_USER is empty in .env.local!");
    console.error("Please add your Gmail address in .env.local on line 4:");
    console.error('SMTP_USER=your_email@gmail.com');
    process.exit(1);
  }

  if (!targetEmail) {
    console.error("\n❌ Error: No target email provided to receive test message.");
    process.exit(1);
  }

  console.log(`\n⏳ Sending test temporary password email to: ${targetEmail}...`);

  const result = await emailService.sendTemporaryPassword({
    toEmail: targetEmail,
    name: "Test Member",
    temporaryPassword: "TempTestPassword123!",
  });

  if (result.success) {
    console.log(`\n✅ SUCCESS! Email sent successfully.`);
    console.log(`Message ID: ${result.messageId}`);
    console.log(`👉 Check inbox of ${targetEmail} (also check Spam/Promotions folder).`);
  } else {
    console.error(`\n❌ FAILED to send email.`);
    console.error(`Error details:`, result.error);
  }
}

main();
