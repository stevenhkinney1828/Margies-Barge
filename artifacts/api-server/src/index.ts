import cron from "node-cron";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function getNowInET(): { dayOfWeek: number; hour: number } {
  const etStr = new Date().toLocaleString("en-US", { timeZone: "America/New_York", hour12: false, weekday: "short", hour: "numeric" });
  const date = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  return { dayOfWeek: date.getDay(), hour: date.getHours() };
}

async function recordMondayEmailSent(): Promise<void> {
  try {
    const { db } = await import("@workspace/db");
    const { settingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const today = getTodayET();
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
    const { buildMondayEmailHtml } = await import("./routes/barge.js");
    const { db } = await import("@workspace/db");
    const { familyMembersTable } = await import("@workspace/db");
    const { eq, and } = await import("drizzle-orm");
    const { sendEmail } = await import("./lib/sendEmail.js");

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

async function maybeSendMondayCatchup(): Promise<void> {
  try {
    const { dayOfWeek, hour } = getNowInET();
    if (dayOfWeek !== 1) return;
    if (hour < 7) return;

    const today = getTodayET();
    const { db } = await import("@workspace/db");
    const { settingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const rows = await db.select({ mondayEmailLastSentDate: settingsTable.mondayEmailLastSentDate })
      .from(settingsTable)
      .where(eq(settingsTable.id, 1));
    const lastSent = rows[0]?.mondayEmailLastSentDate ?? null;
    if (lastSent === today) {
      logger.info({ date: today }, "Monday email already sent today — skipping startup catch-up");
      return;
    }

    logger.info("Startup catch-up: Monday after 7am ET, email not yet sent — sending now");
    await sendMondaySummary();
  } catch (err) {
    logger.error({ err }, "Monday startup catch-up check failed");
  }
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  setTimeout(() => { void maybeSendMondayCatchup(); }, 10_000);
});

cron.schedule("0 7 * * 1", () => { void sendMondaySummary(); }, { timezone: "America/New_York" });
