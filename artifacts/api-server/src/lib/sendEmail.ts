import { getUncachableResendClient } from "./resend.js";

export async function sendEmail(opts: {
  to: string[];
  subject: string;
  html: string;
}): Promise<{ sent: boolean; error?: string }> {
  if (opts.to.length === 0) return { sent: false, error: "No recipients" };
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    const from = fromEmail ?? "Margie's Barge Report <noreply@resend.dev>";
    const { error } = await client.emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { sent: false, error: message };
  }
}
