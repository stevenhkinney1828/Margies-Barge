import nodemailer from "nodemailer";

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (opts.to.length === 0) return { sent: false, error: "No recipients" };
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("Gmail credentials not configured (GMAIL_USER / GMAIL_APP_PASSWORD)");
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: `"Margie's Barge Report" <${user}>`,
      to: opts.to.join(", "),
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, error: message };
  }
}
