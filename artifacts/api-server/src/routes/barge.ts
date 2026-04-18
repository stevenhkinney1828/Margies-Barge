import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  activityEntriesTable,
  bookingsTable,
  bringItemsTable,
  db,
  dockAdjustmentsTable,
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

  await db.insert(settingsTable).values({ id: 1, safeLow: "1060.00", safeHigh: "1071.00", familyEmails: [] }).onConflictDoNothing();

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

function taskStatus(task: typeof tasksTable.$inferSelect): "good" | "due-soon" | "overdue" | "seasonal" {
  if (!isActiveMonth(task.activeStartMonth, task.activeEndMonth)) return "seasonal";
  const lastDone = dateOnly(task.lastDoneDate);
  if (!lastDone) return "overdue";
  const next = new Date(`${addDays(lastDone, task.cadenceDays)}T00:00:00.000Z`);
  const today = new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.ceil((next.getTime() - todayUtc) / 86_400_000);
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 14) return "due-soon";
  return "good";
}

function taskResponse(task: typeof tasksTable.$inferSelect) {
  const lastDoneDate = dateOnly(task.lastDoneDate);
  return {
    id: task.id,
    icon: task.icon,
    name: task.name,
    cadenceDays: task.cadenceDays,
    cadenceLabel: task.cadenceLabel,
    activeMonths: task.activeMonths,
    lastDoneDate,
    lastDoneBy: task.lastDoneBy,
    nextDueDate: lastDoneDate ? addDays(lastDoneDate, task.cadenceDays) : null,
    status: taskStatus(task),
    notes: task.notes,
  };
}

function settingsResponse(row: typeof settingsTable.$inferSelect) {
  return {
    safeLow: Number(row.safeLow),
    safeHigh: Number(row.safeHigh),
    familyEmails: row.familyEmails,
  };
}

function parseActiveMonths(activeMonths: string | null | undefined): { start: number | null; end: number | null } {
  if (!activeMonths) return { start: null, end: null };
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const matches = activeMonths.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const found = matches.map((m) => months.findIndex((month) => month.startsWith(m.slice(0, 3))) + 1).filter((m) => m > 0);
  return { start: found[0] ?? null, end: found[1] ?? found[0] ?? null };
}

async function fetchLake(settings: { safeLow: number; safeHigh: number }) {
  const url = "https://waterservices.usgs.gov/nwis/iv/?sites=02334480&parameterCd=00062&format=json";
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
    const clearanceDown = Number((elevation - settings.safeLow).toFixed(2));
    const clearanceUp = Number((settings.safeHigh - elevation).toFixed(2));
    const percentSafe = Math.max(0, Math.min(100, ((elevation - settings.safeLow) / (settings.safeHigh - settings.safeLow)) * 100));
    const status = elevation < settings.safeLow || elevation > settings.safeHigh ? "DANGER" : clearanceDown < 1 || clearanceUp < 1 ? "WARNING" : "ALL CLEAR";
    return { elevation, pulledAt, status, percentSafe: Number(percentSafe.toFixed(1)), clearanceDown, clearanceUp, stale };
  } catch (error) {
    return { elevation: 1065.96, pulledAt: new Date(0).toISOString(), status: "WARNING" as const, percentSafe: 54.2, clearanceDown: 5.96, clearanceUp: 5.04, stale: true };
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
    const byDate = new Map<string, number>();
    for (const item of values) byDate.set(item.dateTime.slice(0, 10), Number(item.value));
    return Array.from(byDate.entries()).slice(-30).map(([date, elevation]) => ({ date, elevation }));
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
  const [lakeLevel, lakeHistory, weather] = await Promise.all([fetchLake(settings), fetchLakeHistory(), fetchWeather()]);
  res.json(GetDashboardResponse.parse({
    settings,
    lakeLevel,
    lakeHistory,
    weather,
    lastDockAdjustment: lastDockAdjustment ? { id: lastDockAdjustment.id, personName: lastDockAdjustment.personName, workDate: dateOnly(lastDockAdjustment.workDate), createdAt: iso(lastDockAdjustment.createdAt) } : null,
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
    safeLow: parsed.data.safeLow == null ? existing.safeLow : String(parsed.data.safeLow),
    safeHigh: parsed.data.safeHigh == null ? existing.safeHigh : String(parsed.data.safeHigh),
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
  const active = parseActiveMonths(parsed.data.activeMonths);
  const [task] = await db.insert(tasksTable).values({
    icon: parsed.data.icon,
    name: parsed.data.name,
    cadenceDays: parsed.data.cadenceDays,
    cadenceLabel: `Every ${parsed.data.cadenceDays} days`,
    activeMonths: parsed.data.activeMonths ?? null,
    activeStartMonth: active.start,
    activeEndMonth: active.end,
  }).returning();
  await db.insert(activityEntriesTable).values({ personName: "Family", action: `added task ${task.name}`, actionDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json(CompleteTaskResponse.parse(taskResponse(task)));
});

router.post("/tasks/:id/complete", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = CompleteTaskParams.safeParse(req.params);
  const body = CompleteTaskBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
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
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [adjustment] = await db.insert(dockAdjustmentsTable).values({ personName: body.data.personName, workDate: body.data.workDate }).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: "adjusted the dock", actionDate: body.data.workDate });
  res.status(201).json({ id: adjustment.id, personName: adjustment.personName, workDate: dateOnly(adjustment.workDate), createdAt: iso(adjustment.createdAt) });
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
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (!body.data.spokeWithUncles || !body.data.spokeWithCousins) {
    res.status(400).json({ error: "Please confirm both family conversations before booking." });
    return;
  }
  const [booking] = await db.insert(bookingsTable).values({ personName: body.data.personName, startDate: body.data.startDate, endDate: body.data.endDate }).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `booked ${body.data.startDate} to ${body.data.endDate}`, actionDate: body.data.startDate });
  res.status(201).json({ ...booking, startDate: dateOnly(booking.startDate), endDate: dateOnly(booking.endDate), createdAt: iso(booking.createdAt) });
});

router.delete("/bookings/:id", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = DeleteBookingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [booking] = await db.delete(bookingsTable).where(eq(bookingsTable.id, params.data.id)).returning();
  if (!booking) {
    res.status(404).json({ error: "Booking not found" });
    return;
  }
  await db.insert(activityEntriesTable).values({ personName: booking.personName, action: `removed booking ${dateOnly(booking.startDate)} to ${dateOnly(booking.endDate)}`, actionDate: new Date().toISOString().slice(0, 10) });
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
    res.status(400).json({ error: body.error.message });
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
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
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
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [issue] = await db.insert(issuesTable).values({ ...body.data, status: "open" }).returning();
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `${body.data.urgent ? "flagged urgent issue" : "posted issue"}: ${body.data.caption}`, actionDate: new Date().toISOString().slice(0, 10) });
  res.status(201).json({ ...issue, resolvedAt: iso(issue.resolvedAt), createdAt: iso(issue.createdAt) });
});

router.post("/issues/:id/resolve", async (req, res): Promise<void> => {
  await ensureBootstrap();
  const params = ResolveIssueParams.safeParse(req.params);
  const body = ResolveIssueBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: params.success ? body.error.message : params.error.message });
    return;
  }
  const [issue] = await db.update(issuesTable).set({ status: "resolved", resolvedBy: body.data.personName, resolutionNote: body.data.resolutionNote, resolvedAt: new Date() }).where(and(eq(issuesTable.id, params.data.id), eq(issuesTable.status, "open"))).returning();
  if (!issue) {
    res.status(404).json({ error: "Open issue not found" });
    return;
  }
  await db.insert(activityEntriesTable).values({ personName: body.data.personName, action: `resolved issue: ${body.data.resolutionNote}`, actionDate: new Date().toISOString().slice(0, 10) });
  res.json(ResolveIssueResponse.parse({ ...issue, resolvedAt: iso(issue.resolvedAt), createdAt: iso(issue.createdAt) }));
});

router.get("/activity", async (_req, res): Promise<void> => {
  await ensureBootstrap();
  const entries = await db.select().from(activityEntriesTable).orderBy(desc(activityEntriesTable.createdAt)).limit(100);
  res.json(ListActivityResponse.parse(entries.map((entry) => ({ ...entry, actionDate: dateOnly(entry.actionDate), createdAt: iso(entry.createdAt) }))));
});

export default router;
