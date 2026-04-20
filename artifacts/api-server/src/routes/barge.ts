import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { sendEmail } from "../lib/sendEmail.js";
import { sendMondaySummary } from "../lib/mondayEmail.js";
import { urgentIssueHtml, urgentIssueResolvedHtml, bookingRemovedHtml, mondaySummaryHtml } from "../lib/emails.js";
import { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../lib/gcal.js";
import {
  activityEntriesTable,
  bookingsTable,
  bringItemsTable,
  db,
  dockAdjustmentsTable,
  familyMembersTable,
  issuesTable,
  settingsTable,
  tasksTable,
} from "@workspace/db";
import {
  CompleteTaskBody,
  CompleteTaskParams,
  CompleteTaskResponse,
  CreateBookingBody,
  CreateBringItemBody,
  CreateDockAdjustmentBody,
  CreateIssueBody,
  CreateTaskBody,
  DeleteBookingParams,
  DeleteBringItemBody,
  DeleteBringItemParams,
  DeleteTaskParams,
  GetDashboardResponse,
  GetSettingsResponse,
  ListActivityResponse,
  ListBookingsResponse,
  ListBringItemsResponse,
  ListIssuesQueryParams,
  ListIssuesResponse,
  ListTasksResponse,
  ResolveIssueBody,
  ResolveIssueParams,
  ResolveIssueResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
  UpdateTaskBody,
  UpdateTaskParams,
  UpdateTaskResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
let bootstrapped = false;

const DEFAULT_TASKS = [
  { icon: "🦷", name: "Bug Spray", cadenceDays: 90, cadenceLabel: "Every 90 days", activeMonths: null, activeStartMonth: null, activeEndMonth: null, lastDoneDate: null, lastDoneBy: null, notes: null },
  { icon: "🌿", name: "Weed Whacking", cadenceDays: 30, cadenceLabel: "Every 30 days", activeMonths: "Apr – Sep", activeStartMonth: 4, activeEndMonth: 9, lastDoneDate: null, lastDoneBy: null, notes: "Goes quiet Oct – Mar" },
  { icon: "💧", name: "Roundup / Weed Spray", cadenceDays: 30, cadenceLabel: "Every 30 days", activeMonths: "Mar – Jun", activeStartMonth: 3, activeEndMonth: 6, lastDoneDate: null, lastDoneBy: null, notes: "Goes quiet Jul – Feb" },
  { icon: "🔋", name: "Golf Cart Batteries", cadenceDays: 120, cadenceLabel: "Every 120 days", activeMonths: null, activeStartMonth: null, activeEndMonth: null, lastDoneDate: "2026-04-17", lastDoneBy: "Steven", notes: null },
  { icon: "⛵", name: "Put Boat In Water", cadenceDays: 365, cadenceLabel: "Annual", activeMonths: "Mar – May", activeStartMonth: 3, activeEndMonth: 5, lastDoneDate: null, lastDoneBy: null, notes: "Surfaces Mar 1" },
  { icon: "⛵", name: "Pull Boat / Winterize", cadenceDays: 365, cadenceLabel: "Annual", activeMonths: "Sep – Nov", activeStartMonth: 9, activeEndMonth: 11, lastDoneDate: null, lastDoneBy: null, notes: "Surfaces Sep 15" },
];

async function ensureBootstrap(): Promise<void> {
  if (bootstrapped) return;

  await db.insert(settingsTable).values({ id: 1, familyEmails: [] }).onConflictDoNothing();

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(tasksTable);
  if (count === 0) {
    await db.insert(tasksTable).values(DEFAULT_TASKS);
    await db.insert(dockAdjustmentsTable).values({ personName: "Steven", workDate: "2026-04-17" });
    await db.insert(activityEntriesTable).values([
      { personName: "Steven", action: "checked golf cart batteries", actionDate: "2026-04-17" },
      { personName: "Steven", action: "adjusted the dock", actionDate: "2026-04-17" },
    ]);
  }

  bootstrapped = true;
}

function dateOnly(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.toISOString();
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isActiveMonth(start: number | null, end: number | null, now = new Date()): boolean {
  if (!start || !end) return true;
  const month = now.getMonth() + 1;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

function computeCadenceLabel(days: number): string {
  if (days === 7) return "Weekly";
  if (days === 14) return "Every 2 weeks";
  if (days === 30) return "Monthly";
  if (days === 60) return "Every 2 months";
  if (days === 90) return "Every 3 months";
  if (days === 120) return "Every 4 months";
  if (days === 180) return "Every 6 months";
  if (days === 365) return "Annually";
  return `Every ${days} days`;
}

function isInActiveMonths(task: typeof tasksTable.$inferSelect, now = new Date()): boolean {
  const nums = task.activeMonthNums;
  if (nums && nums.length > 0) {
    return nums.includes(now.getMonth() + 1);
  }
  return isActiveMonth(task.activeStartMonth, task.activeEndMonth, now);
}

function taskStatus(task: typeof tasksTable.$inferSelect): "good" | "due-soon" | "overdue" | "seasonal" {
  const lastDone = dateOnly(task.lastDoneDate);
  // Never done — always overdue regardless of season
  if (!lastDone) return "overdue";

  const next = new Date(`${addDays(lastDone, task.cadenceDays)}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.ceil((next.getTime() - todayUtc) / 86_400_000);

  // Past due — always overdue regardless of season; nothing falls through the cracks
  if (daysUntil < 0) return "overdue";

  // Not yet due — now check season. Seasonal only applies to tasks that still have time left.
  if (!isInActiveMonths(task)) return "seasonal";
  if (daysUntil <= 14) return "due-soon";
  return "good";
}

function taskResponse(task: typeof tasksTable.$inferSelect) {
  const lastDoneDate = dateOnly(task.lastDoneDate);
  const activeMonthNums = task.activeMonthNums ?? null;
  return {
    id: task.id,
    icon: task.icon,
    name: task.name,
    cadenceDays: task.cadenceDays,
    cadenceLabel: computeCadenceLabel(task.cadenceDays),
    activeMonths: task.activeMonths,
    activeMonthNums,
    lastDoneDate,
    lastDoneBy: task.lastDoneBy,
    nextDueDate: lastDoneDate ? addDays(lastDoneDate, task.cadenceDays) : null,
    status: taskStatus(task),
    notes: task.notes,
  };
}

function settingsResponse(row: typeof settingsTable.$inferSelect) {
  return {
    familyEmails: row.familyEmails,
  };
}

function dockAdjustmentResponse(adjustment: typeof dockAdjustmentsTable.$inferSelect) {
  return {
    id: adjustment.id,
    personName: adjustment.personName,
    workDate: dateOnly(adjustment.workDate),
    clearanceUp: adjustment.clearanceUp == null ? null : Number(adjustment.clearanceUp),
    clearanceDown: adjustment.clearanceDown == null ? null : Number(adjustment.clearanceDown),
    lakeElevation: adjustment.lakeElevation == null ? null : Number(adjustment.lakeElevation),
    lakeLevelPulledAt: iso(adjustment.lakeLevelPulledAt),
    createdAt: iso(adjustment.createdAt),
  };
}

function parseActiveMonths(activeMonths: string | null | undefined): { start: number | null; end: number | null } {
  if (!activeMonths) return { start: null, end: null };
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const matches = activeMonths.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const found = matches.map((m) => months.findIndex((month) => month.startsWith(m.slice(0, 3))) + 1).filter((m) => m > 0);
  return { start: found[0] ?? null, end: found[1] ?? found[0] ?? null };
}

async function fetchLake(limits: { upperDockLimit: number | null; lowerDockLimit: number | null }) {
  const url = "https://waterservices.usgs.gov/nwis/iv/?sites=02334480&parameterCd=00062&format=json";
  const computeDerived = (elevation: number) => {
    const clearanceUp = limits.upperDockLimit != null ? Number((limits.upperDockLimit - elevation).toFixed(2)) : 0;
    const clearanceDown = limits.lowerDockLimit != null ? Number((elevation - limits.lowerDockLimit).toFixed(2)) : 0;
    let status: "ALL CLEAR" | "WARNING" | "DANGER" = "ALL CLEAR";
    let percentSafe = 50;
    if (limits.upperDockLimit != null && limits.lowerDockLimit != null) {
      if (elevation > limits.upperDockLimit || elevation < limits.lowerDockLimit) status = "DANGER";
      else if (clearanceUp < 1 || clearanceDown < 1) status = "WARNING";
      const range = limits.upperDockLimit - limits.lowerDockLimit;
      percentSafe = range > 0 ? Math.max(0, Math.min(100, ((elevation - limits.lowerDockLimit) / range) * 100)) : 50;
    }
    return { clearanceUp, clearanceDown, status, percentSafe: Number(percentSafe.toFixed(1)) };
  };
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`USGS returned ${response.status}`);
    const json = await response.json() as { value?: { timeSeries?: Array<{ values?: Array<{ value?: Array<{ value: string; dateTime: string }> }> }> } };
    const values = json.value?.timeSeries?.[0]?.values?.[0]?.value ?? [];
    const latest = values[values.length - 1];
    if (!latest) throw new Error("USGS returned no readings");
    const elevation = Number(latest.value);
    const pulledAt = latest.dateTime;
    const stale = Date.now() - new Date(pulledAt).getTime() > 86_400_000;
    return { elevation, pulledAt, stale, ...computeDerived(elevation) };
  } catch (error) {
    const elevation = 1065.96;
    return { elevation, pulledAt: new Date(0).toISOString(), stale: true, ...computeDerived(elevation) };
  }
}

async function fetchLakeLevelForDate(workDate: string): Promise<{ elevation: number; pulledAt: string } | null> {
  const start = new Date(`${workDate}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  const url = `https://waterservices.usgs.gov/nwis/iv/?sites=02334480&parameterCd=00062&format=json&startDT=${workDate}&endDT=${end.toISOString().slice(0, 10)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`USGS daily lookup returned ${response.status}`);
    const json = await response.json() as { value?: { timeSeries?: Array<{ values?: Array<{ value?: Array<{ value: string; dateTime: string }> }> }> } };
    const values = json.value?.timeSeries?.[0]?.values?.[0]?.value ?? [];
    if (values.length === 0) return null;
    const noon = new Date(`${workDate}T12:00:00.000Z`).getTime();
    const closest = values.reduce((best, item) => {
      const bestDistance = Math.abs(new Date(best.dateTime).getTime() - noon);
      const itemDistance = Math.abs(new Date(item.dateTime).getTime() - noon);
      return itemDistance < bestDistance ? item : best;
    });
    return {
      elevation: Number(Number(closest.value).toFixed(2)),
      pulledAt: closest.dateTime,
    };
  } catch {
    return null;
  }
}

async function fetchLakeHistory() {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const startDT = start.toISOString().slice(0, 10);
  const url = `https://waterservices.usgs.gov/nwis/iv/?sites=02334480&parameterCd=00062&format=json&startDT=${startDT}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`USGS history returned ${response.status}`);
    const json = await response.json() as { value?: { timeSeries?: Array<{ values?: Array<{ value?: Array<{ value: string; dateTime: string }> }> }> } };
    const values = json.value?.timeSeries?.[0]?.values?.[0]?.value ?? [];
    if (values.length === 0) throw new Error("USGS history returned no readings");
    const byDate = new Map<string, number>();
    for (const item of values) byDate.set(item.dateTime.slice(0, 10), Number(item.value));
    const points = Array.from(byDate.entries()).slice(-30).map(([date, elevation]) => ({ date, elevation }));
    if (points.length === 0) throw new Error("USGS history yielded no daily points");
    return points;
  } catch {
    return Array.from({ length: 30 }, (_, index) => ({
      date: addDays(new Date().toISOString().slice(0, 10), index - 29),
      elevation: Number((1064.8 + Math.sin(index / 3) * 1.1).toFixed(2)),
    }));
  }
}

async function fetchWeather() {
  try {
    const point = await fetch("https://api.weather.gov/points/34.2979,-83.8241", { headers: { "User-Agent": "MargiesBargeReport/1.0" } });
    if (!point.ok) throw new Error(`NWS point returned ${point.status}`);
    const pointJson = await point.json() as { properties?: { forecast?: string } };
    if (!pointJson.properties?.forecast) throw new Error("NWS forecast URL missing");
    const forecast = await fetch(pointJson.properties.forecast, { headers: { "User-Agent": "MargiesBargeReport/1.0" } });
    if (!forecast.ok) throw new Error(`NWS forecast returned ${forecast.status}`);
    const forecastJson = await forecast.json() as { properties?: { periods?: Array<{ startTime: string; name: string; shortForecast: string; icon: string; temperature: number; probabilityOfPrecipitation?: { value: number | null } | null; isDaytime: boolean }> } };
    return (forecastJson.properties?.periods ?? [])
      .filter((period) => period.isDaytime)
      .slice(0, 7)
      .map((period) => ({
        date: period.startTime.slice(0, 10),
        name: period.name,
        shortForecast: period.shortForecast,
        icon: period.icon,
        highTemp: period.temperature,
        rainProbability: period.probabilityOfPrecipitation?.value ?? 0,
      }));
  } catch {
    const names = ["Today", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return names.map((name, index) => ({
      date: addDays(new Date().toISOString().slice(0, 10), index),
      name,
      shortForecast: index === 2 ? "Chance Showers" : "Partly Sunny",
      icon: "",
      highTemp: 76 + (index % 4),
      rainProbability: index === 2 ? 65 : 20,
    }));
  }
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const [settingsRow] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  const settings = settingsResponse(settingsRow);
  const [lastDockAdjustment] = await db.select().from(dockAdjustmentsTable).orderBy(desc(dockAdjustmentsTable.workDate), desc(dockAdjustmentsTable.createdAt)).limit(1);
  const loggedElev = lastDockAdjustment?.lakeElevation == null ? null : Number(lastDockAdjustment.lakeElevation);
  const loggedUp = lastDockAdjustment?.clearanceUp == null ? null : Number(lastDockAdjustment.clearanceUp);
  const loggedDown = lastDockAdjustment?.clearanceDown == null ? null : Number(lastDockAdjustment.clearanceDown);
  const upperDockLimit = loggedElev != null && loggedUp != null ? loggedElev + loggedUp : null;
  const lowerDockLimit = loggedElev != null && loggedDown != null ? loggedElev - loggedDown : null;
  const [lakeLevel, lakeHistory, weather] = await Promise.all([fetchLake({ upperDockLimit, lowerDockLimit }), fetchLakeHistory(), fetchWeather()]);
  res.json(GetDashboardResponse.parse({
    settings,
    lakeLevel,
    lakeHistory,
    weather,
    lastDockAdjustment: lastDockAdjustment ? dockAdjustmentResponse(lastDockAdjustment) : null,
  }));
});

router.get("/settings", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const [settingsRow] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
  res.json(GetSettingsResponse.parse(settingsResponse(settingsRow)));
});

router.patch("/settings", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const current = await db.select().from(settingsTable).where(eq(settingsTable.id, 1)).limit(1);
  const existing = current[0];
  const [updated] = await db.update(settingsTable).set({
    familyEmails: parsed.data.familyEmails ?? existing.familyEmails,
  }).where(eq(settingsTable.id, 1)).returning();
  res.json(UpdateSettingsResponse.parse(settingsResponse(updated)));
});

router.get("/tasks", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const tasks = await db.select().from(tasksTable).orderBy(tasksTable.id);
  res.json(ListTasksResponse.parse(tasks.map(taskResponse)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const monthNums = parsed.data.activeMonthNums && parsed.data.activeMonthNums.length > 0 ? parsed.data.activeMonthNums : null;
  const [task] = await db.insert(tasksTable).values({
    icon: parsed.data.icon,
    name: parsed.data.name,
    cadenceDays: parsed.data.cadenceDays,
    cadenceLabel: computeCadenceLabel(parsed.data.cadenceDays),
    activeMonths: null,
    activeStartMonth: null,
    activeEndMonth: null,
    activeMonthNums: monthNums,
    notes: parsed.data.notes ?? null,
  }).returning();
  await db.insert(activityEntriesTable).values({ personName: "Family", action: `added task "${task.name}"`, actionDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json(CompleteTaskResponse.parse(taskResponse(task)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = UpdateTaskParams.safeParse(req.params);
  const body = UpdateTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? (body.error?.message ?? "Invalid body") : params.error.message });
    return;
  }
  const existing = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Task not found" }); return; }

  const monthNums = body.data.activeMonthNums != null
    ? (body.data.activeMonthNums.length === 0 ? null : body.data.activeMonthNums)
    : existing[0].activeMonthNums;

  const cadenceDays = body.data.cadenceDays ?? existing[0].cadenceDays;
  const [task] = await db.update(tasksTable).set({
    icon: body.data.icon ?? existing[0].icon,
    name: body.data.name ?? existing[0].name,
    cadenceDays,
    cadenceLabel: computeCadenceLabel(cadenceDays),
    activeMonthNums: monthNums,
    lastDoneDate: body.data.lastDoneDate !== undefined ? body.data.lastDoneDate : existing[0].lastDoneDate,
    lastDoneBy: body.data.lastDoneBy !== undefined ? body.data.lastDoneBy : existing[0].lastDoneBy,
    notes: body.data.notes !== undefined ? body.data.notes : existing[0].notes,
  }).where(eq(tasksTable.id, params.data.id)).returning();
  await db.insert(activityEntriesTable).values({ personName: "Family", action: `updated task "${task.name}"`, actionDate: new Date().toISOString().slice(0, 10) });
  res.json(UpdateTaskResponse.parse(taskResponse(task)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [task] = await db.delete(tasksTable).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }
  await db.insert(activityEntriesTable).values({ personName: "Family", action: `deleted task "${task.name}"`, actionDate: new Date().toISOString().slice(0, 10) });
  res.sendStatus(204);
});

router.post("/tasks/:id/complete", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = CompleteTaskParams.safeParse(req.params);
  const body = CompleteTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid body" : params.error.message });
    return;
  }
  const [task] = await db.update(tasksTable).set({ lastDoneDate: body.data.workDate, lastDoneBy: body.data.personName }).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `marked ${task.name} done`, actionDate: body.data.workDate });
  res.json(CompleteTaskResponse.parse(taskResponse(task)));
});

router.post("/dock-adjustments", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const body = CreateDockAdjustmentBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error?.message ?? "Invalid body" });
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = Math.floor((new Date(today).getTime() - new Date(body.data.workDate).getTime()) / 86_400_000);
  const historicalLake = await fetchLakeLevelForDate(body.data.workDate);
  const currentLake = historicalLake == null && daysAgo >= 0 && daysAgo <= 7 ? await fetchLake({ upperDockLimit: null, lowerDockLimit: null }) : null;
  const lakeForDate = historicalLake ?? (currentLake == null ? null : { elevation: currentLake.elevation, pulledAt: currentLake.pulledAt });
  const [adjustment] = await db.insert(dockAdjustmentsTable).values({
    personName: body.data.personName,
    workDate: body.data.workDate,
    clearanceUp: String(body.data.clearanceUp),
    clearanceDown: String(body.data.clearanceDown),
    lakeElevation: lakeForDate == null ? null : String(lakeForDate.elevation),
    lakeLevelPulledAt: lakeForDate == null ? null : new Date(lakeForDate.pulledAt),
  }).returning();
  const lakeNote = lakeForDate == null ? "" : ` at lake level ${lakeForDate.elevation}'`;
  await db.insert(activityEntriesTable).values({
    personName: body.data.personName,
    action: `adjusted the dock (${body.data.clearanceUp}' up / ${body.data.clearanceDown}' down${lakeNote})`,
    actionDate: body.data.workDate,
  });
  res.status(201).json(dockAdjustmentResponse(adjustment));
});

router.get("/bookings", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const bookings = await db.select().from(bookingsTable).orderBy(bookingsTable.startDate);
  res.json(ListBookingsResponse.parse(bookings.map((booking) => ({ ...booking, startDate: dateOnly(booking.startDate), endDate: dateOnly(booking.endDate), createdAt: iso(booking.createdAt) }))));
});

router.post("/bookings", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const body = CreateBookingBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error?.message ?? "Invalid body" });
    return;
  }
  if (!body.data.spokeWithUncles || !body.data.spokeWithCousins) {
    res.status(400).json({ error: "Please confirm both family conversations before booking." });
    return;
  }
  const [booking] = await db.insert(bookingsTable).values({ personName: body.data.personName, startDate: body.data.startDate, endDate: body.data.endDate }).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `booked ${body.data.startDate} to ${body.data.endDate}`, actionDate: body.data.startDate });

  // Create Google Calendar event — fire-and-forget; a GCal failure never blocks the booking
  createCalendarEvent({ personName: booking.personName, startDate: body.data.startDate, endDate: body.data.endDate })
    .then((gcalEventId) => db.update(bookingsTable).set({ googleEventId: gcalEventId }).where(eq(bookingsTable.id, booking.id)))
    .catch((err) => console.error("Google Calendar create failed:", err));

  res.status(201).json({ ...booking, startDate: dateOnly(booking.startDate), endDate: dateOnly(booking.endDate), createdAt: iso(booking.createdAt) });
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = DeleteBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Fetch first so we have the googleEventId, then delete
  const [existing] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Booking not found" }); return; }

  const [booking] = await db.delete(bookingsTable).where(eq(bookingsTable.id, params.data.id)).returning();
  if (!booking) { res.status(404).json({ error: "Booking not found" }); return; }

  const removedAt = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  await db.insert(activityEntriesTable).values({ personName: booking.personName, action: `removed booking ${dateOnly(booking.startDate)} to ${dateOnly(booking.endDate)}`, actionDate: new Date().toISOString().slice(0, 10) });

  // Delete Google Calendar event if one was created
  if (existing.googleEventId) {
    deleteCalendarEvent(existing.googleEventId).catch((err) => console.error("Google Calendar delete failed:", err));
  }

  // Send removal email to family members with notifications enabled
  const notifMembers = await db.select().from(familyMembersTable)
    .where(and(eq(familyMembersTable.notifications, true)));
  const notifEmails = notifMembers.map(m => m.email).filter(Boolean) as string[];
  if (notifEmails.length > 0) {
    sendEmail({
      to: notifEmails,
      subject: `📅 Dates back open at the lake house`,
      html: bookingRemovedHtml({ personName: booking.personName, startDate: dateOnly(booking.startDate) ?? "", endDate: dateOnly(booking.endDate) ?? "" }),
    }).catch(() => void 0);
  }
  res.sendStatus(204);
});

router.get("/bring-items", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const items = await db.select().from(bringItemsTable).orderBy(desc(bringItemsTable.createdAt));
  res.json(ListBringItemsResponse.parse(items.map((item) => ({ ...item, createdAt: iso(item.createdAt) }))));
});

router.post("/bring-items", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const body = CreateBringItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error?.message ?? "Invalid body" });
    return;
  }
  const [item] = await db.insert(bringItemsTable).values(body.data).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `added bring item: ${body.data.description}`, actionDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json({ ...item, createdAt: iso(item.createdAt) });
});

router.delete("/bring-items/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = DeleteBringItemParams.safeParse(req.params);
  const body = DeleteBringItemBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid body" : params.error.message });
    return;
  }
  const [item] = await db.delete(bringItemsTable).where(eq(bringItemsTable.id, params.data.id)).returning();
  if (!item) {
    res.status(404).json({ error: "Bring item not found" });
    return;
  }
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `marked ${item.description} brought`, actionDate: body.data.broughtDate });
  res.sendStatus(204);
});

router.get("/issues", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const query = ListIssuesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const issues = await db.select().from(issuesTable).where(query.data.includeResolved ? undefined : eq(issuesTable.status, "open")).orderBy(desc(issuesTable.createdAt));
  res.json(ListIssuesResponse.parse(issues.map((issue) => ({ ...issue, resolvedAt: iso(issue.resolvedAt), createdAt: iso(issue.createdAt) }))));
});

router.post("/issues", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const body = CreateIssueBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error?.message ?? "Invalid body" });
    return;
  }
  const [issue] = await db.insert(issuesTable).values({ ...body.data, status: "open" }).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `${body.data.urgent ? "flagged urgent issue" : "posted issue"}: ${body.data.caption}`, actionDate: new Date().toISOString().slice(0, 10) });
  if (body.data.urgent) {
    const urgentMembers = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.notifications, true)));
    const urgentEmails = urgentMembers.map(m => m.email).filter(Boolean) as string[];
    if (urgentEmails.length > 0) {
      sendEmail({
        to: urgentEmails,
        subject: `🚨 Urgent Issue at the Lake House: ${body.data.caption}`,
        html: urgentIssueHtml({ reportedBy: body.data.personName, caption: body.data.caption, photoUrl: body.data.photoUrl }),
      }).catch(() => void 0);
    }
  }
  res.status(201).json({ ...issue, resolvedAt: iso(issue.resolvedAt), createdAt: iso(issue.createdAt) });
});

router.post("/issues/:id/resolve", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = ResolveIssueParams.safeParse(req.params);
  const body = ResolveIssueBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error?.message ?? "Invalid body" : params.error.message });
    return;
  }
  const [issue] = await db.update(issuesTable).set({ status: "resolved", resolvedBy: body.data.personName, resolutionNote: body.data.resolutionNote, resolvedAt: new Date() }).where(and(eq(issuesTable.id, params.data.id), eq(issuesTable.status, "open"))).returning();
  if (!issue) {
    res.status(404).json({ error: "Open issue not found" });
    return;
  }
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `resolved issue: ${body.data.resolutionNote}`, actionDate: new Date().toISOString().slice(0, 10) });
  // Send resolution email to family members with notifications enabled
  if (issue.urgent) {
    const resolveMembers = await db.select().from(familyMembersTable)
      .where(and(eq(familyMembersTable.notifications, true)));
    const resolveEmails = resolveMembers.map(m => m.email).filter(Boolean) as string[];
    if (resolveEmails.length > 0) {
      sendEmail({
        to: resolveEmails,
        subject: `✅ Urgent issue resolved at the lake house`,
        html: urgentIssueResolvedHtml({ resolvedBy: body.data.personName, resolutionNote: body.data.resolutionNote }),
      }).catch(() => void 0);
    }
  }
  res.json(ResolveIssueResponse.parse({ ...issue, resolvedAt: iso(issue.resolvedAt), createdAt: iso(issue.createdAt) }));
});

router.get("/activity", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const entries = await db.select().from(activityEntriesTable).orderBy(desc(activityEntriesTable.createdAt)).limit(100);
  res.json(ListActivityResponse.parse(entries.map((entry) => ({ ...entry, actionDate: dateOnly(entry.actionDate), createdAt: iso(entry.createdAt) }))));
});

export async function buildMondayEmailHtml(): Promise<{ html: string; subject: string }> {
  const today = new Date();
  const todayMs = today.getTime();
  const todayStr = today.toISOString().slice(0, 10);
  const in14 = addDays(todayStr, 14);
  const in30 = addDays(todayStr, 30);

  const [lastDockAdj] = await db.select().from(dockAdjustmentsTable).orderBy(desc(dockAdjustmentsTable.workDate), desc(dockAdjustmentsTable.createdAt)).limit(1);
  const loggedElev = lastDockAdj?.lakeElevation == null ? null : Number(lastDockAdj.lakeElevation);
  const loggedUp = lastDockAdj?.clearanceUp == null ? null : Number(lastDockAdj.clearanceUp);
  const loggedDown = lastDockAdj?.clearanceDown == null ? null : Number(lastDockAdj.clearanceDown);
  const upperDockLimit = loggedElev != null && loggedUp != null ? loggedElev + loggedUp : null;
  const lowerDockLimit = loggedElev != null && loggedDown != null ? loggedElev - loggedDown : null;

  const [lakeLevel, weather, tasks, issues, bringRows, activityRows] = await Promise.all([
    fetchLake({ upperDockLimit, lowerDockLimit }),
    fetchWeather(),
    db.select().from(tasksTable).orderBy(tasksTable.id),
    db.select().from(issuesTable).where(eq(issuesTable.status, "open")),
    db.select().from(bringItemsTable).orderBy(desc(bringItemsTable.createdAt)),
    db.select().from(activityEntriesTable)
      .where(gte(activityEntriesTable.actionDate, addDays(todayStr, -7)))
      .orderBy(desc(activityEntriesTable.createdAt)).limit(20),
  ]);

  const toUpperDock = upperDockLimit != null ? Number((upperDockLimit - lakeLevel.elevation).toFixed(2)) : null;
  const toLowerDock = lowerDockLimit != null ? Number((lakeLevel.elevation - lowerDockLimit).toFixed(2)) : null;

  const overdueTasks = tasks.filter(t => taskStatus(t) === "overdue")
    .map(t => {
      const nextDueDate = t.lastDoneDate ? addDays(dateOnly(t.lastDoneDate)!, t.cadenceDays) : null;
      const daysOverdue = nextDueDate ? Math.floor((todayMs - new Date(nextDueDate).getTime()) / 86400000) : undefined;
      return { icon: t.icon, name: t.name, nextDueDate, daysOverdue, lastDoneBy: t.lastDoneBy, lastDoneDate: t.lastDoneDate ? dateOnly(t.lastDoneDate) : null };
    });

  const dueSoonTasks = tasks.filter(t => taskStatus(t) === "due-soon")
    .map(t => {
      const nextDueDate = t.lastDoneDate ? addDays(dateOnly(t.lastDoneDate)!, t.cadenceDays) : null;
      const daysRemaining = nextDueDate ? Math.max(0, Math.floor((new Date(nextDueDate).getTime() - todayMs) / 86400000)) : undefined;
      return { icon: t.icon, name: t.name, nextDueDate, daysRemaining, lastDoneBy: t.lastDoneBy, lastDoneDate: t.lastDoneDate ? dateOnly(t.lastDoneDate) : null };
    });

  const upcomingTasks = tasks.filter(t => {
    const last = dateOnly(t.lastDoneDate);
    if (!last) return false;
    const next = addDays(last, t.cadenceDays);
    return next > in14 && next <= in30 && taskStatus(t) !== "seasonal";
  }).map(t => ({ icon: t.icon, name: t.name, nextDueDate: addDays(dateOnly(t.lastDoneDate)!, t.cadenceDays) }));

  const appUrl = process.env.APP_URL ?? "https://margies-barge.replit.app";
  const subject = `Margie's Barge Report -- ${today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const html = mondaySummaryHtml({
    lakeElevation: lakeLevel.elevation,
    lakeStatus: lakeLevel.status,
    toUpperDock,
    toLowerDock,
    upperDockLimit,
    lowerDockLimit,
    lakePulledAt: lakeLevel.pulledAt,
    weatherDays: weather,
    overdueTasks,
    dueSoonTasks,
    upcomingTasks,
    bringItems: bringRows.map(b => ({ description: b.description, personName: b.personName, createdAt: b.createdAt ? dateOnly(b.createdAt) : null })),
    openIssues: issues.map(i => ({ caption: i.caption, personName: i.personName, urgent: i.urgent, createdAt: i.createdAt ? dateOnly(i.createdAt) : null })),
    recentActivity: activityRows.map(a => ({ personName: a.personName, action: a.action, actionDate: dateOnly(a.actionDate)! })),
    appUrl,
  });
  return { html, subject };
}

router.post("/email/monday-summary", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const mondayMembers = await db.select().from(familyMembersTable)
    .where(and(eq(familyMembersTable.mondayEmail, true)));
  const emails = mondayMembers.map(m => m.email).filter(Boolean) as string[];
  if (emails.length === 0) {
    res.status(400).json({ sent: false, error: "No family members have Monday Email enabled." });
    return;
  }
  const { html, subject } = await buildMondayEmailHtml();
  const result = await sendEmail({ to: emails, subject, html, replyTo: emails });
  if (result.sent) {
    res.json({ sent: true, recipients: emails.length });
  } else {
    res.status(500).json({ sent: false, error: result.error });
  }
});

router.post("/cron/monday-summary", async (req, res): Promise<void> => {
  const cronSecret = process.env["CRON_SECRET"];
  if (!cronSecret || req.headers["x-cron-secret"] !== cronSecret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const { getMondayEmailLastSentDate } = await import("../lib/mondayEmail.js");
  const lastSent = await getMondayEmailLastSentDate();
  if (lastSent === today) {
    res.json({ sent: false, reason: "already_sent_today" });
    return;
  }

  const result = await sendMondaySummary();
  if (result.sent) {
    res.json({ sent: true, recipients: result.recipients });
  } else {
    res.json({ sent: false, error: result.error });
  }
});

router.post("/email/test", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const testEmail = process.env.GMAIL_USER;
  if (!testEmail) {
    res.status(400).json({ sent: false, error: "GMAIL_USER not configured" });
    return;
  }
  const { html, subject } = await buildMondayEmailHtml();
  const result = await sendEmail({ to: [testEmail], subject: `[TEST] ${subject}`, html });
  if (result.sent) {
    res.json({ sent: true, recipients: 1, to: testEmail });
  } else {
    res.status(500).json({ sent: false, error: result.error });
  }
});

// ── Family Members ────────────────────────────────────────────────────────────

const FamilyMemberBody = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  appAccess: z.boolean().optional().default(false),
  notifications: z.boolean().optional().default(false),
  mondayEmail: z.boolean().optional().default(false),
});
const FamilyMemberParams = z.object({ id: z.coerce.number().int().positive() });

function familyMemberResponse(m: typeof familyMembersTable.$inferSelect) {
  return {
    id: m.id,
    name: m.name,
    email: m.email ?? null,
    phone: m.phone ?? null,
    appAccess: m.appAccess,
    notifications: m.notifications,
    mondayEmail: m.mondayEmail,
    createdAt: iso(m.createdAt),
  };
}

router.get("/family-members", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const members = await db.select().from(familyMembersTable).orderBy(familyMembersTable.id);
  res.json(members.map(familyMemberResponse));
});

router.post("/family-members", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const parsed = FamilyMemberBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [member] = await db.insert(familyMembersTable).values({
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    phone: parsed.data.phone ?? null,
    appAccess: parsed.data.appAccess ?? false,
    notifications: parsed.data.notifications ?? false,
    mondayEmail: parsed.data.mondayEmail ?? false,
  }).returning();
  res.status(201).json(familyMemberResponse(member));
});

router.patch("/family-members/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = FamilyMemberParams.safeParse(req.params);
  const parsed = FamilyMemberBody.partial().safeParse(req.body);
  if (!params.success || !parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const existing = await db.select().from(familyMembersTable).where(eq(familyMembersTable.id, params.data.id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Member not found" }); return; }
  const [updated] = await db.update(familyMembersTable).set({
    name: parsed.data.name ?? existing[0].name,
    email: parsed.data.email !== undefined ? (parsed.data.email ?? null) : existing[0].email,
    phone: parsed.data.phone !== undefined ? (parsed.data.phone ?? null) : existing[0].phone,
    appAccess: parsed.data.appAccess ?? existing[0].appAccess,
    notifications: parsed.data.notifications ?? existing[0].notifications,
    mondayEmail: parsed.data.mondayEmail ?? existing[0].mondayEmail,
  }).where(eq(familyMembersTable.id, params.data.id)).returning();
  res.json(familyMemberResponse(updated));
});

router.delete("/family-members/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = FamilyMemberParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [deleted] = await db.delete(familyMembersTable).where(eq(familyMembersTable.id, params.data.id)).returning();
  if (!deleted) { res.status(404).json({ error: "Member not found" }); return; }
  res.sendStatus(204);
});

// ── Edit Booking ─────────────────────────────────────────────────────────────

const UpdateBookingBody = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
const UpdateBookingParams = z.object({ id: z.coerce.number().int().positive() });

router.patch("/bookings/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = UpdateBookingParams.safeParse(req.params);
  const body = UpdateBookingBody.safeParse(req.body);
  if (!params.success || !body.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const existing = await db.select().from(bookingsTable).where(eq(bookingsTable.id, params.data.id)).limit(1);
  if (!existing[0]) { res.status(404).json({ error: "Booking not found" }); return; }
  const [updated] = await db.update(bookingsTable).set({
    startDate: body.data.startDate,
    endDate: body.data.endDate,
  }).where(eq(bookingsTable.id, params.data.id)).returning();
  // Update Google Calendar event — fire-and-forget
  if (existing[0].googleEventId) {
    updateCalendarEvent(existing[0].googleEventId, {
      personName: existing[0].personName,
      startDate: body.data.startDate,
      endDate: body.data.endDate,
    }).catch(err => console.error("Google Calendar update failed:", err));
  }
  res.json({ ...updated, startDate: dateOnly(updated.startDate), endDate: dateOnly(updated.endDate), createdAt: iso(updated.createdAt) });
});

export default router;
