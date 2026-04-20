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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

async function sendMondaySummary() {
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
    } else {
      logger.error({ error: result.error }, "Monday email failed");
    }
  } catch (err) {
    logger.error({ err }, "Monday email job threw an error");
  }
}

cron.schedule("0 7 * * 1", () => { void sendMondaySummary(); }, { timezone: "America/New_York" });
