export type EmailResult = { sent: boolean; error?: string };

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fmtShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function mondaySummaryHtml(opts: {
  lakeElevation: number;
  lakeStatus: string;
  clearanceUp: number;
  clearanceDown: number;
  lakePulledAt: string;
  weatherDays: Array<{ name: string; shortForecast: string; rainProbability: number; highTemp: number }>;
  overdueTasks: Array<{ icon: string; name: string; nextDueDate: string | null }>;
  dueSoonTasks: Array<{ icon: string; name: string; nextDueDate: string | null }>;
  upcomingTasks: Array<{ icon: string; name: string; nextDueDate: string | null }>;
  bringItems: Array<{ description: string; personName: string }>;
  openIssues: Array<{ caption: string; personName: string; urgent: boolean }>;
  recentActivity: Array<{ personName: string; action: string; actionDate: string }>;
  openSlots: Array<{ start: string; end: string }>;
  appUrl: string;
}): string {
  const {
    lakeElevation, lakeStatus, clearanceUp, clearanceDown, lakePulledAt,
    weatherDays, overdueTasks, dueSoonTasks, upcomingTasks,
    bringItems, openIssues, recentActivity, openSlots, appUrl,
  } = opts;

  const statusColor = lakeStatus === "ALL CLEAR" ? "#1e3a5f" : lakeStatus === "WARNING" ? "#d97706" : "#dc2626";
  const statusBg    = lakeStatus === "ALL CLEAR" ? "#eff6ff" : lakeStatus === "WARNING" ? "#fffbeb" : "#fef2f2";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const section = (title: string, body: string) => `
    <div style="background:#fff;border-radius:10px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06);">
      <h2 style="margin:0 0 12px;font-size:13px;font-family:sans-serif;text-transform:uppercase;letter-spacing:.07em;color:#64748b;font-weight:700;">${title}</h2>
      ${body}
    </div>`;

  const lakeSection = section("Lake Level", `
    <div style="background:${statusBg};border-radius:8px;padding:14px 18px;display:flex;align-items:center;gap:16px;">
      <div>
        <div style="font-size:32px;font-weight:700;color:${statusColor};line-height:1;">${lakeElevation.toFixed(2)}'</div>
        <div style="font-family:sans-serif;font-size:13px;color:${statusColor};font-weight:600;margin-top:2px;">${lakeStatus}</div>
      </div>
      <div style="font-family:sans-serif;font-size:13px;color:#475569;line-height:1.6;">
        ${clearanceDown.toFixed(2)}' above safe low<br>
        ${clearanceUp.toFixed(2)}' below safe high
      </div>
    </div>`);

  const rainRows = weatherDays.slice(0, 7).map(w => {
    const rain = w.rainProbability ?? 0;
    const rainColor = rain >= 50 ? "#1e3a5f" : "#94a3b8";
    return `<tr>
      <td style="font-family:sans-serif;font-size:13px;color:#334155;padding:5px 0;min-width:80px;">${w.name}</td>
      <td style="font-family:sans-serif;font-size:13px;color:#475569;padding:5px 8px;">${w.shortForecast}</td>
      <td style="font-family:sans-serif;font-size:13px;color:${rainColor};padding:5px 0;text-align:right;">${rain}% rain</td>
    </tr>`;
  }).join("");
  const weatherSection = section("7-Day Rainfall Outlook", `<table style="width:100%;border-collapse:collapse;">${rainRows}</table>`);

  const taskSection = (title: string, tasks: typeof overdueTasks, color: string) =>
    tasks.length === 0 ? "" :
    section(title, `<ul style="margin:0;padding:0;list-style:none;">${tasks.map(t => `
      <li style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #f1f5f9;">
        <span style="font-size:18px;">${t.icon}</span>
        <div>
          <span style="font-family:sans-serif;font-size:14px;color:#1e293b;">${t.name}</span>
          ${t.nextDueDate ? `<span style="font-family:sans-serif;font-size:12px;color:${color};margin-left:8px;">due ${fmtShort(t.nextDueDate)}</span>` : ""}
        </div>
      </li>`).join("")}</ul>`);

  const overdueSection  = taskSection("Overdue & Due Soon", [...overdueTasks, ...dueSoonTasks], "#dc2626");
  const upcomingSection = upcomingTasks.length === 0 ? "" :
    taskSection("Coming Up in the Next 30 Days", upcomingTasks, "#d97706");

  const bringSection = bringItems.length === 0 ? "" :
    section("Bring Next Time", `<ul style="margin:0;padding-left:18px;font-family:sans-serif;font-size:14px;color:#334155;line-height:1.8;">
      ${bringItems.map(i => `<li>${i.description} <span style="color:#94a3b8;font-size:12px;">(added by ${i.personName})</span></li>`).join("")}
    </ul>`);

  const issuesSection = openIssues.length === 0 ? "" :
    section("Open Issues", `<ul style="margin:0;padding:0;list-style:none;">${openIssues.map(i => `
      <li style="padding:6px 0;border-bottom:1px solid #f1f5f9;">
        ${i.urgent ? `<span style="background:#fef2f2;color:#dc2626;font-family:sans-serif;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;margin-right:6px;">URGENT</span>` : ""}
        <span style="font-family:sans-serif;font-size:14px;color:#1e293b;">${i.caption}</span>
        <span style="font-family:sans-serif;font-size:12px;color:#94a3b8;margin-left:6px;">reported by ${i.personName}</span>
      </li>`).join("")}</ul>`);

  const activitySection = recentActivity.length === 0 ? "" :
    section("Notable Activity This Week", `<ul style="margin:0;padding:0;list-style:none;">${recentActivity.slice(0, 8).map(a => `
      <li style="font-family:sans-serif;font-size:13px;color:#475569;padding:4px 0;border-bottom:1px solid #f8fafc;">
        <strong style="color:#1e293b;">${a.personName}</strong> ${a.action}
        <span style="color:#94a3b8;font-size:11px;margin-left:6px;">${fmtShort(a.actionDate)}</span>
      </li>`).join("")}</ul>`);

  const slotsSection = openSlots.length === 0 ? "" :
    section("Open Dates at the Lake", `
      <p style="font-family:sans-serif;font-size:14px;color:#334155;margin:0 0 12px;">
        The following stretches are open in the next 60 days — grab 'em while they're free!
      </p>
      <ul style="margin:0;padding-left:18px;font-family:sans-serif;font-size:14px;color:#1e3a5f;line-height:1.9;">
        ${openSlots.map(s => `<li>${fmtDate(s.start)} – ${fmtDate(s.end)}</li>`).join("")}
      </ul>`);

  const pulledStr = lakePulledAt ? new Date(lakePulledAt).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }) : "unavailable";

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;margin:0;">
<div style="max-width:560px;margin:0 auto;">
  <div style="background:#1e3a5f;border-radius:12px 12px 0 0;padding:24px 28px;">
    <h1 style="margin:0;color:#fff;font-size:22px;font-family:Georgia,serif;">⚓ Margie's Barge Report</h1>
    <p style="margin:6px 0 0;color:#93c5fd;font-family:sans-serif;font-size:13px;">${today}</p>
  </div>
  <div style="padding:16px 0;">
    ${lakeSection}
    ${weatherSection}
    ${overdueSection}
    ${upcomingSection}
    ${bringSection}
    ${issuesSection}
    ${activitySection}
    ${slotsSection}
    <div style="background:#fff;border-radius:10px;padding:20px 24px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06);text-align:center;">
      <a href="${appUrl}" style="display:inline-block;background:#1e3a5f;color:#fff;font-family:sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Open Margie's Barge Report</a>
    </div>
  </div>
  <div style="text-align:center;font-family:sans-serif;font-size:11px;color:#94a3b8;padding-bottom:24px;">
    Kinney Lake House · Lake Lanier · Margie's Barge Report<br>
    Lake data last successfully pulled: ${pulledStr}
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
    <p style="margin:0 0 16px;font-family:sans-serif;font-size:14px;color:#475569;">Hey everyone — <strong style="color:#1e293b;">${reportedBy}</strong> flagged something at the lake that needs attention. Check the app for details and the photo.</p>
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;font-family:sans-serif;">Issue</p>
    <p style="margin:0 0 20px;font-size:16px;">${caption}</p>
    ${photoUrl ? `<img src="${photoUrl}" alt="Issue photo" style="max-width:100%;border-radius:8px;margin-top:8px;" />` : ""}
  </div>
</div>
</body></html>`;
}

export function urgentIssueResolvedHtml(opts: {
  resolvedBy: string;
  resolutionNote: string;
}): string {
  const { resolvedBy, resolutionNote } = opts;
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <div style="background:#16a34a;padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">✅ Issue Resolved</h1>
    <p style="margin:4px 0 0;color:#bbf7d0;font-family:sans-serif;font-size:13px;">Kinney Lake House · Margie's Barge Report</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 16px;font-family:sans-serif;font-size:15px;color:#1e293b;">
      Good news — <strong>${resolvedBy}</strong> resolved the issue flagged at the lake.
    </p>
    <p style="margin:0;font-size:15px;color:#334155;font-style:italic;">"${resolutionNote}"</p>
  </div>
</div>
</body></html>`;
}

export function bookingRemovedHtml(opts: {
  personName: string;
  startDate: string;
  endDate: string;
}): string {
  const { personName, startDate, endDate } = opts;
  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#f1f5f9;padding:24px;color:#1e293b;">
<div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">
  <div style="background:#1e3a5f;padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">📅 Dates Back Open</h1>
    <p style="margin:4px 0 0;color:#94a3b8;font-family:sans-serif;font-size:13px;">Kinney Lake House · Margie's Barge Report</p>
  </div>
  <div style="padding:24px;">
    <p style="margin:0 0 16px;font-family:sans-serif;font-size:15px;color:#1e293b;">
      Hey everyone — just a heads up that <strong>${personName}</strong> had to free up
      <strong>${fmtDate(startDate)}</strong> to <strong>${fmtDate(endDate)}</strong> at the lake.
      Those days are open again if anyone wants them!
    </p>
  </div>
</div>
</body></html>`;
}
