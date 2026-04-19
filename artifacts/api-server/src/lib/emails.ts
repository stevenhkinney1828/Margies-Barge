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

const NAVY = "#0B3D5E";
const CARD_STYLE = `background:#ffffff;border-radius:8px;border:1px solid #e2e8f0;padding:20px 24px;margin-bottom:14px;`;
const SECTION_HEAD = `font-family:sans-serif;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${NAVY};margin:0 0 12px;`;
const BODY_TEXT = `font-family:sans-serif;font-size:14px;color:#334155;line-height:1.6;`;
const MUTED = `font-family:sans-serif;font-size:12px;color:#94a3b8;`;

function card(icon: string, title: string, body: string): string {
  return `<div style="${CARD_STYLE}">
    <h2 style="${SECTION_HEAD}">${icon}&nbsp;&nbsp;${title}</h2>
    ${body}
  </div>`;
}

export function mondaySummaryHtml(opts: {
  lakeElevation: number;
  lakeStatus: string;
  clearanceUp: number | null;
  clearanceDown: number | null;
  lakePulledAt: string;
  weatherDays: Array<{ name: string; shortForecast: string; rainProbability: number; highTemp: number }>;
  overdueTasks: Array<{ icon: string; name: string; nextDueDate: string | null; daysOverdue?: number; lastDoneBy?: string | null; lastDoneDate?: string | null }>;
  dueSoonTasks: Array<{ icon: string; name: string; nextDueDate: string | null; daysRemaining?: number; lastDoneBy?: string | null; lastDoneDate?: string | null }>;
  upcomingTasks: Array<{ icon: string; name: string; nextDueDate: string | null }>;
  bringItems: Array<{ description: string; personName: string; createdAt?: string | null }>;
  openIssues: Array<{ caption: string; personName: string; urgent: boolean; createdAt?: string | null }>;
  recentActivity: Array<{ personName: string; action: string; actionDate: string }>;
  appUrl: string;
}): string {
  const {
    lakeElevation, lakeStatus, clearanceUp, clearanceDown, lakePulledAt,
    weatherDays, overdueTasks, dueSoonTasks, upcomingTasks,
    bringItems, openIssues, recentActivity, appUrl,
  } = opts;

  const weekOf = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  const statusInfo: Record<string, { label: string; color: string; bg: string; description: string }> = {
    "ALL CLEAR": {
      label: "All Clear",
      color: "#15803d",
      bg: "#f0fdf4",
      description: "Lake is in great shape — no concerns heading into the week.",
    },
    "WARNING": {
      label: "Heads Up",
      color: "#b45309",
      bg: "#fffbeb",
      description: "Lake is approaching safe limits — worth keeping an eye on conditions.",
    },
    "DANGER": {
      label: "Attention Needed",
      color: "#dc2626",
      bg: "#fef2f2",
      description: "Lake is outside safe operating range — please check before heading out.",
    },
  };
  const si = statusInfo[lakeStatus] ?? statusInfo["WARNING"];

  const lakeSection = card("⚓", "Lake Status", `
    <div style="background:${si.bg};border-radius:6px;padding:14px 18px;display:flex;gap:20px;align-items:flex-start;">
      <div style="flex-shrink:0;">
        <div style="font-size:30px;font-weight:700;color:${si.color};font-family:sans-serif;line-height:1;">${lakeElevation.toFixed(2)}'</div>
        <div style="font-family:sans-serif;font-size:12px;font-weight:700;color:${si.color};margin-top:2px;text-transform:uppercase;letter-spacing:.04em;">${si.label}</div>
      </div>
      <div>
        <div style="${BODY_TEXT}margin:0;">${si.description}</div>
        <div style="${MUTED}margin-top:6px;">
          ${clearanceDown != null ? `${clearanceDown.toFixed(2)}' above safe low` : ""}
          ${clearanceUp != null ? `&nbsp;·&nbsp;${clearanceUp.toFixed(2)}' below safe high` : ""}
        </div>
      </div>
    </div>`);

  const rainDays = weatherDays.slice(0, 7);
  const highRainDays = rainDays.filter(w => (w.rainProbability ?? 0) > 60);
  const weatherRows = rainDays.map(w => {
    const rain = w.rainProbability ?? 0;
    const isHigh = rain > 60;
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="font-family:sans-serif;font-size:13px;color:#1e293b;padding:7px 0;font-weight:${isHigh ? "700" : "400"};">${w.name}</td>
      <td style="font-family:sans-serif;font-size:13px;color:#475569;padding:7px 12px;">${w.shortForecast}</td>
      <td style="font-family:sans-serif;font-size:13px;color:${isHigh ? "#1d4ed8" : "#94a3b8"};padding:7px 0;text-align:right;font-weight:${isHigh ? "700" : "400"};">${rain}%</td>
    </tr>`;
  }).join("");
  const rainNote = highRainDays.length > 0
    ? `<p style="${MUTED}margin:10px 0 0;">⚠️ Heavy rain expected ${highRainDays.map(d => d.name).join(", ")} — keep an eye on lake levels.</p>`
    : "";
  const weatherSection = card("🌦️", "This Week's Weather", `
    <table style="width:100%;border-collapse:collapse;">${weatherRows}</table>
    ${rainNote}`);

  const attentionTasks = [...overdueTasks, ...dueSoonTasks];
  const attentionSection = attentionTasks.length === 0 ? "" : card("🚨", "Needs Attention", `
    <ul style="margin:0;padding:0;list-style:none;">
    ${attentionTasks.map(t => {
      const isOverdue = "daysOverdue" in t && t.daysOverdue !== undefined;
      const days = isOverdue
        ? `<span style="color:#dc2626;font-weight:700;">${(t as any).daysOverdue} day${(t as any).daysOverdue === 1 ? "" : "s"} overdue</span>`
        : `<span style="color:#d97706;font-weight:700;">${(t as any).daysRemaining ?? 0} day${(t as any).daysRemaining === 1 ? "" : "s"} left</span>`;
      const lastDone = t.lastDoneBy
        ? `<span style="${MUTED}"> · Last done by ${t.lastDoneBy}${t.lastDoneDate ? ` on ${fmtShort(t.lastDoneDate)}` : ""}</span>`
        : `<span style="${MUTED}"> · Never completed</span>`;
      return `<li style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f8fafc;">
        <span style="font-size:18px;line-height:1.4;">${t.icon}</span>
        <div>
          <div style="font-family:sans-serif;font-size:14px;color:#1e293b;font-weight:600;">${t.name}</div>
          <div style="margin-top:2px;">${days}${lastDone}</div>
        </div>
      </li>`;
    }).join("")}
    </ul>`);

  const upcomingSection = upcomingTasks.length === 0 ? "" : card("📅", "Coming Up in the Next 30 Days", `
    <ul style="margin:0;padding:0;list-style:none;">
    ${upcomingTasks.map(t => `
      <li style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid #f8fafc;">
        <span style="font-size:16px;">${t.icon}</span>
        <span style="font-family:sans-serif;font-size:14px;color:#334155;">${t.name}</span>
        ${t.nextDueDate ? `<span style="${MUTED}margin-left:auto;">due ${fmtShort(t.nextDueDate)}</span>` : ""}
      </li>`).join("")}
    </ul>`);

  const bringSection = bringItems.length === 0 ? "" : card("🛒", "Bring Next Time", `
    <ul style="margin:0;padding:0;list-style:none;">
    ${bringItems.map(i => `
      <li style="padding:7px 0;border-bottom:1px solid #f8fafc;">
        <span style="font-family:sans-serif;font-size:14px;color:#1e293b;">${i.description}</span>
        <span style="${MUTED}margin-left:8px;">added by ${i.personName}${i.createdAt ? ` · ${fmtShort(i.createdAt)}` : ""}</span>
      </li>`).join("")}
    </ul>`);

  const issuesSection = openIssues.length === 0 ? "" : card("⚠️", "Open Issues", `
    <ul style="margin:0;padding:0;list-style:none;">
    ${openIssues.map(i => `
      <li style="padding:8px 0;border-bottom:1px solid #f8fafc;">
        ${i.urgent ? `<span style="background:#fef2f2;color:#dc2626;font-family:sans-serif;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px;margin-right:6px;text-transform:uppercase;">Urgent</span>` : ""}
        <span style="font-family:sans-serif;font-size:14px;color:#1e293b;">${i.caption}</span>
        <div style="${MUTED}margin-top:3px;">Posted by ${i.personName}${i.createdAt ? ` on ${fmtShort(i.createdAt)}` : ""}</div>
      </li>`).join("")}
    </ul>`);

  const activitySection = recentActivity.length === 0 ? "" : card("📋", "Recent Activity", `
    <ul style="margin:0;padding:0;list-style:none;">
    ${recentActivity.slice(0, 10).map(a => `
      <li style="font-family:sans-serif;font-size:13px;color:#475569;padding:5px 0;border-bottom:1px solid #f8fafc;">
        <strong style="color:#1e293b;">${a.personName}</strong> ${a.action} <span style="${MUTED}">on ${fmtShort(a.actionDate)}</span>
      </li>`).join("")}
    </ul>`);

  const pulledStr = lakePulledAt ? new Date(lakePulledAt).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  }) : "unavailable";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Margie's Barge Report</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

      <!-- HEADER -->
      <tr><td style="background:${NAVY};border-radius:10px 10px 0 0;padding:28px 30px 24px;">
        <div style="font-family:Georgia,serif;font-size:24px;color:#ffffff;font-weight:bold;margin:0;">⚓ Margie's Barge Report</div>
        <div style="font-family:sans-serif;font-size:13px;color:#93c5fd;margin-top:6px;">Lake Lanier, GA &nbsp;—&nbsp; Week of ${weekOf}</div>
      </td></tr>

      <!-- BODY -->
      <tr><td style="padding:16px 0;">
        ${lakeSection}
        ${weatherSection}
        ${attentionSection}
        ${upcomingSection}
        ${bringSection}
        ${issuesSection}
        ${activitySection}
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="background:${NAVY};border-radius:0 0 10px 10px;padding:22px 30px;text-align:center;">
        <a href="${appUrl}" style="display:inline-block;color:#ffffff;font-family:sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:10px 24px;border:2px solid rgba(255,255,255,.4);border-radius:6px;">View the full app &rarr;</a>
        <div style="font-family:sans-serif;font-size:11px;color:#7fb3d3;margin-top:14px;">Lake data last successfully pulled: ${pulledStr}</div>
        <div style="font-family:sans-serif;font-size:11px;color:#7fb3d3;margin-top:4px;">Kinney Lake House &nbsp;·&nbsp; Lake Lanier</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
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
  <div style="background:${NAVY};padding:20px 24px;">
    <h1 style="margin:0;color:#fff;font-size:20px;">📅 Dates Back Open</h1>
    <p style="margin:4px 0 0;color:#93c5fd;font-family:sans-serif;font-size:13px;">Kinney Lake House · Margie's Barge Report</p>
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
