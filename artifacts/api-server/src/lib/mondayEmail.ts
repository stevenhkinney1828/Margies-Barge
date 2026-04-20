import { logger } from "./logger.js";

export async function recordMondayEmailSent(): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { settingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    await db.update(settingsTable)
      .set({ mondayEmailLastSentDate: today })
      .where(eq(settingsTable.id, 1));
    logger.info({ date: today }, "Recorded Monday email sent date");
  } catch (err) {
    logger.error({ err }, "Failed to record Monday email sent date");
  }
}

export async function sendMondaySummary(): Promise<void> {
  try {
    logger.info("Running Monday morning email job");
    const { buildMondayEmailHtml } = await import("../routes/barge.js");
    const { db } = await import("@workspace/db");
    const { familyMembersTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const { sendEmail } = await import("./sendEmail.js");

    const mondayMembers = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.mondayEmail, true)));
    const emails = mondayMembers.map((m: { email: string | null }) => m.email).filter(Boolean) as string[];
    if (emails.length === 0) {
      logger.info("No Monday email recipients configured — skipping");
      return;
    }
    const { html, subject } = await buildMondayEmailHtml();
    const result = await sendEmail({ to: emails, subject, html, replyTo: emails });
    if (result.sent) {
      logger.info({ recipients: emails.length }, "Monday email sent");
      await recordMondayEmailSent();
    } else {
      logger.error({ error: result.error }, "Monday email failed");
    }
  } catch (err) {
    logger.error({ err }, "Monday email job threw an error");
  }
}
