const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars";

async function getAccessToken(): Promise<string> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error("Google Calendar credentials not configured");
  }
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get Google access token: ${text}`);
  }
  const json = await res.json() as { access_token: string };
  return json.access_token;
}

function calendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("GOOGLE_CALENDAR_ID not configured");
  return encodeURIComponent(id);
}

export async function createCalendarEvent(params: {
  personName: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD (inclusive)
}): Promise<string> {
  const token = await getAccessToken();
  // Google Calendar all-day events: endDate must be exclusive (day after last night)
  const endDateExclusive = addOneDay(params.endDate);
  const body = {
    summary: params.personName,
    description: `Lake house stay — booked via Margie's Barge Report`,
    start: { date: params.startDate },
    end:   { date: endDateExclusive },
  };
  const res = await fetch(
    `${CALENDAR_BASE}/${calendarId()}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create Google Calendar event: ${text}`);
  }
  const json = await res.json() as { id: string };
  return json.id;
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(
    `${CALENDAR_BASE}/${calendarId()}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  // 404 means already gone — treat as success
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(`Failed to delete Google Calendar event: ${text}`);
  }
}

function addOneDay(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
