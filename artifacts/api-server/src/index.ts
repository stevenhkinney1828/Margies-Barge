import cron from "node-cron";
import app from "./app";
import { logger } from "./lib/logger";
import { sendMondaySummary } from "./lib/mondayEmail.js";

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
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = dayNames.indexOf(parts["weekday"] ?? "");
  const hour = parseInt(parts["hour"] ?? "0", 10);
  return { dayOfWeek, hour };
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
