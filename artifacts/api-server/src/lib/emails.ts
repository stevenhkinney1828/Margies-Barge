export type EmailResult = { sent: boolean; error?: string };

export function mondaySummaryHtml(opts: {
  lakeElevation: number;
  lakeStatus: string;
  overdueTasks: Array<{ icon: string; name: string }>;
  dueSoonTasks: Array<{ icon: string; name: string }>;
  openIssues: number;
  urgentIssues: number;
  upcomingBookings: Array<{ personName: string; startDate: string; endDate: string }>;
}): string {
  const { lakeElevation, lakeStatus, overdueTasks, dueSoonTasks, openIssues, urgentIssues, upcomingBookings } = opts;
  const statusColor = lakeStatus === "ALL CLEAR" ? "#2563eb" : lakeStatus === "WARNING" ? "#d97706" : "#dc2626";
  const taskRows = (tasks: typeof overdueTasks, label: string, color: string) =>
    tasks.length === 0
      ? ""
      : `<p style="margin:16px 0 4px;font-weight:600;color:${color};">${label}</p><ul style="margin:0;padding-left:20px;">${tasks.map((t) => `<li>${t.icon} ${t.name}</li>`).join("")}</ul>`;
  const bookingRows =
    upcomingBookings.length === 0
      ? `<p style="color:#6b7280;">No upcoming bookings in the next 30 days.</p>`
      : `<ul style="margin:0;padding-left:20px;">${upcomingBookings.map((b) => `<li><strong>${b.personName}</strong> — ${b.startDate} to ${b.endDate}</li>`).join("")}</ul>`;

  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <div style="background:#1e2e47;padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:22px;">⚓ Margie's Barge Report</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-family:sans-serif;font-size:13px;">Monday Morning Summary — ${new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
  </div>
  <div style="padding:24px;">
    <h2 style="margin:0 0 4px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-family:sans-serif;">Lake Level</h2>
    <p style="margin:0 0 20px;font-size:32px;font-weight:700;color:${statusColor};">${lakeElevation.toFixed(2)}'<span style="font-size:16px;margin-left:8px;font-family:sans-serif;">${lakeStatus}</span></p>

    <h2 style="margin:0 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-family:sans-serif;">Tasks</h2>
    ${taskRows(overdueTasks, "Overdue", "#dc2626")}
    ${taskRows(dueSoonTasks, "Due soon", "#d97706")}
    ${overdueTasks.length === 0 && dueSoonTasks.length === 0 ? `<p style="color:#16a34a;">All tasks are up to date ✓</p>` : ""}

    <h2 style="margin:20px 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-family:sans-serif;">Issues</h2>
    <p style="margin:0 0 20px;">${openIssues} open${urgentIssues > 0 ? ` — <strong style="color:#dc2626;">${urgentIssues} urgent</strong>` : ""}</p>

    <h2 style="margin:0 0 8px;font-size:15px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;font-family:sans-serif;">Upcoming Stays</h2>
    ${bookingRows}
  </div>
  <div style="background:#f8fafc;padding:12px 24px;border-top:1px solid #e2e8f0;font-family:sans-serif;font-size:12px;color:#94a3b8;">
    Kinney Lake House · Lake Lanier · Margie's Barge Report
  </div>
</div>
</body></html>`;
}

export function urgentIssueHtml(opts: {
  reportedBy: string;
  caption: string;
  photoUrl: string;
}): string {
  const { reportedBy, caption, photoUrl } = opts;
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <div style="background:#dc2626;padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">🚨 Urgent Issue Reported</h1>
    <p style="margin:4px 0 0;color:#fecaca;font-family:sans-serif;font-size:13px;">Kinney Lake House · Margie's Barge Report</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-family:sans-serif;">Reported by</p>
    <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${reportedBy}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-family:sans-serif;">Issue</p>
    <p style="margin:0 0 20px;font-size:16px;">${caption}</p>
    ${photoUrl ? `<img src="${photoUrl}" alt="Issue photo" style="max-width:100%;border-radius:8px;margin-top:8px;" />` : ""}
  </div>
</div>
</body></html>`;
}

export function bookingRemovedHtml(opts: {
  personName: string;
  startDate: string;
  endDate: string;
  removedAt: string;
}): string {
  const { personName, startDate, endDate, removedAt } = opts;
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <div style="background:#1e2e47;padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">📅 Booking Removed</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-family:sans-serif;font-size:13px;">Kinney Lake House · Margie's Barge Report</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 16px;color:#6b7280;font-family:sans-serif;font-size:14px;">A booking was removed on ${removedAt}.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-family:sans-serif;">Person</p>
    <p style="margin:0 0 16px;font-size:18px;font-weight:600;">${personName}</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-family:sans-serif;">Dates</p>
    <p style="margin:0;font-size:18px;">${startDate} → ${endDate}</p>
  </div>
</div>
</body></html>`;
}
