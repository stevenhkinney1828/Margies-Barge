import { useGetDashboard, useCreateDockAdjustment, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Anchor, ArrowUp, ArrowDown, History, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Label as ChartLabel } from "recharts";

export function DockTab() {
  const { data: dashboard, isLoading, error } = useGetDashboard();
  const queryClient = useQueryClient();
  const createDockAdjustment = useCreateDockAdjustment();
  const [isOpen, setIsOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [workDate, setWorkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clearanceUp, setClearanceUp] = useState("");
  const [clearanceDown, setClearanceDown] = useState("");

  if (isLoading) return (
    <div className="flex justify-center items-center pt-16">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );
  if (error || !dashboard) return <div className="p-4 text-destructive text-sm">Failed to load dashboard data.</div>;

  const { lakeLevel, lakeHistory, lastDockAdjustment, weather } = dashboard;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !clearanceUp || !clearanceDown) return;
    await createDockAdjustment.mutateAsync({
      data: { personName, workDate, clearanceUp: Number(clearanceUp), clearanceDown: Number(clearanceDown) },
    });
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    setIsOpen(false);
    setPersonName("");
    setClearanceUp("");
    setClearanceDown("");
  };

  // ── Compute dock-position-relative limits ─────────────────────────────────
  // The logged clearances are measured from the lake level AT the time of the
  // last dock move, giving us absolute elevation limits for the current dock.
  const loggedElev = lastDockAdjustment?.lakeElevation ?? null;
  const loggedUp   = lastDockAdjustment?.clearanceUp   ?? null;
  const loggedDown = lastDockAdjustment?.clearanceDown  ?? null;

  const upperDockLimit = loggedElev != null && loggedUp   != null ? loggedElev + loggedUp   : null;
  const lowerDockLimit = loggedElev != null && loggedDown != null ? loggedElev - loggedDown : null;

  const toUpperNow = upperDockLimit != null ? upperDockLimit - lakeLevel.elevation : null;
  const toLowerNow = lowerDockLimit != null ? lakeLevel.elevation - lowerDockLimit : null;

  // Status derived from dock limits (fall back to zone settings)
  const dockStatus: "CLEAR" | "CAUTION" | "DANGER" =
    toUpperNow != null && toLowerNow != null
      ? toUpperNow < 0 || toLowerNow < 0
        ? "DANGER"
        : toUpperNow < 1 || toLowerNow < 1
        ? "CAUTION"
        : "CLEAR"
      : lakeLevel.status === "ALL CLEAR"
      ? "CLEAR"
      : lakeLevel.status === "WARNING"
      ? "CAUTION"
      : "DANGER";

  const statusMeta = {
    CLEAR:   { label: "All Clear",    bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", num: "text-emerald-700", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" /> },
    CAUTION: { label: "Caution",      bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   num: "text-amber-700",   icon: <AlertTriangle className="w-5 h-5 text-amber-600" /> },
    DANGER:  { label: "Danger",       bg: "bg-red-50 border-red-200",         text: "text-red-700",     num: "text-red-700",     icon: <AlertTriangle className="w-5 h-5 text-red-600" /> },
  }[dockStatus];

  return (
    <div className="space-y-4 pb-8">

      {/* ── Hero: Today's Lake Level ───────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 ${statusMeta.bg}`}>
        <div className="flex items-center gap-2 mb-1">
          {statusMeta.icon}
          <span className={`text-xs font-bold font-sans uppercase tracking-widest ${statusMeta.text}`}>{statusMeta.label}</span>
        </div>

        <div className={`font-serif text-5xl font-bold tracking-tight mt-1 mb-0.5 ${statusMeta.num}`}>
          {lakeLevel.elevation.toFixed(2)}<span className="text-2xl ml-1">ft</span>
        </div>
        <p className="text-xs font-sans opacity-60 mb-5">
          Lake Lanier elevation · {lakeLevel.stale ? "data may be stale" : `updated ${format(new Date(lakeLevel.pulledAt), "h:mm a")}`}
        </p>

        {/* Distance-to-limits row */}
        <div className="grid grid-cols-2 gap-3">
          <LimitChip
            label="To upper dock limit"
            value={toUpperNow}
            fallbackLabel="Upper safe zone"
            fallbackValue={lakeLevel.clearanceUp}
            direction="up"
            statusText={statusMeta.text}
          />
          <LimitChip
            label="To lower dock limit"
            value={toLowerNow}
            fallbackLabel="Lower safe zone"
            fallbackValue={lakeLevel.clearanceDown}
            direction="down"
            statusText={statusMeta.text}
          />
        </div>

        {toUpperNow == null && (
          <p className="text-[10px] font-sans opacity-50 mt-2 text-center">
            Log a dock move to see clearances relative to your dock position
          </p>
        )}
      </div>

      {/* ── Last Dock Move ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 px-5 pt-4 pb-3 border-b border-border/50">
          <Anchor className="w-4 h-4 text-primary" />
          <h2 className="font-serif text-base font-semibold">Last Dock Move</h2>
        </div>

        {lastDockAdjustment ? (
          <div className="px-5 py-4 space-y-4">
            {/* Date + person */}
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-xl">
                {format(new Date(lastDockAdjustment.workDate + "T12:00:00"), "MMMM d, yyyy")}
              </span>
              <span className="text-sm text-muted-foreground">by {lastDockAdjustment.personName}</span>
            </div>

            {/* Lake level that day */}
            <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider font-sans text-blue-600 mb-0.5">Lake level that day</p>
              <p className="font-serif text-2xl text-blue-900">
                {lastDockAdjustment.lakeElevation != null
                  ? `${lastDockAdjustment.lakeElevation.toFixed(2)}'`
                  : "—"}
              </p>
              {lastDockAdjustment.lakeLevelPulledAt && (
                <p className="text-[10px] text-blue-500 mt-0.5 font-sans">
                  USGS · {format(new Date(lastDockAdjustment.lakeLevelPulledAt), "MMM d, h:mm a")}
                </p>
              )}
            </div>

            {/* Logged thresholds */}
            {loggedUp != null && loggedDown != null && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <ArrowUp className="w-3 h-3 text-emerald-600" />
                    <p className="text-[10px] uppercase tracking-wider font-sans text-emerald-700">Clearance up</p>
                  </div>
                  <p className="font-serif text-2xl text-emerald-900">{loggedUp.toFixed(1)}'</p>
                  {upperDockLimit != null && (
                    <p className="text-[10px] text-emerald-600 mt-0.5 font-sans">limit at {upperDockLimit.toFixed(2)}'</p>
                  )}
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <div className="flex items-center gap-1 mb-0.5">
                    <ArrowDown className="w-3 h-3 text-amber-600" />
                    <p className="text-[10px] uppercase tracking-wider font-sans text-amber-700">Clearance down</p>
                  </div>
                  <p className="font-serif text-2xl text-amber-900">{loggedDown.toFixed(1)}'</p>
                  {lowerDockLimit != null && (
                    <p className="text-[10px] text-amber-600 mt-0.5 font-sans">limit at {lowerDockLimit.toFixed(2)}'</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground italic">No dock moves logged yet.</p>
        )}

        {/* Log Dock Move button */}
        <div className="px-5 pb-5">
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-12 text-base font-serif" size="lg">
                Log Dock Move
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Log a Dock Move</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdjust} className="space-y-5 mt-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  The app automatically pulls the USGS lake level for the date you pick. Enter how much clearance you have above and below the dock's new position.
                </p>

                <div className="space-y-2">
                  <Label htmlFor="personName">Who moved it?</Label>
                  <Input id="personName" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="e.g. Uncle John" required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workDate">Date moved</Label>
                  <Input id="workDate" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
                </div>

                <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-3">
                  <p className="text-xs font-semibold font-sans uppercase tracking-wider text-muted-foreground">Clearances at new dock position</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="clearanceUp" className="flex items-center gap-1">
                        <ArrowUp className="w-3.5 h-3.5 text-emerald-600" /> Feet up
                      </Label>
                      <Input id="clearanceUp" type="number" step="0.1" min="0" inputMode="decimal"
                        value={clearanceUp} onChange={(e) => setClearanceUp(e.target.value)} placeholder="5.0" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clearanceDown" className="flex items-center gap-1">
                        <ArrowDown className="w-3.5 h-3.5 text-amber-600" /> Feet down
                      </Label>
                      <Input id="clearanceDown" type="number" step="0.1" min="0" inputMode="decimal"
                        value={clearanceDown} onChange={(e) => setClearanceDown(e.target.value)} placeholder="4.0" required />
                    </div>
                  </div>
                </div>

                <Button type="submit" className="w-full h-12 text-base font-serif" disabled={createDockAdjustment.isPending}>
                  {createDockAdjustment.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Dock Move"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── 30-day trend ──────────────────────────────────────────────────── */}
      {lakeHistory && lakeHistory.length > 0 && (() => {
        const elevations = lakeHistory.map((p) => p.elevation);
        const dataMin = Math.min(...elevations);
        const dataMax = Math.max(...elevations);
        const yLow  = Math.min(dataMin, lowerDockLimit ?? dataMin) - 0.5;
        const yHigh = Math.max(dataMax, upperDockLimit ?? dataMax) + 0.5;
        return (
        <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h2 className="font-serif text-base font-semibold">30-Day Lake Level</h2>
            </div>
            {upperDockLimit != null && lowerDockLimit != null && (
              <span className="text-[10px] text-muted-foreground font-sans">
                Safe range: {lowerDockLimit.toFixed(2)}'–{upperDockLimit.toFixed(2)}'
              </span>
            )}
          </div>
          <div className="h-[230px] pt-4 pr-5 pb-1 pl-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lakeHistory.slice(-30)} margin={{ top: 8, right: 60, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v + "T12:00:00"), "M/d")} axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} dy={8} interval="preserveStartEnd" minTickGap={28} />
                <YAxis domain={[yLow, yHigh]} axisLine={false} tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => v.toFixed(1)} width={48} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
                  labelFormatter={(v) => format(new Date(v + "T12:00:00"), "MMM d")}
                  formatter={(v: number) => [`${v.toFixed(2)}'`, "Elevation"]} />
                {upperDockLimit != null && lowerDockLimit != null && (
                  <ReferenceArea y1={lowerDockLimit} y2={upperDockLimit} fill="#10b981" fillOpacity={0.06} />
                )}
                {upperDockLimit != null && (
                  <ReferenceLine y={upperDockLimit} stroke="#dc2626" strokeDasharray="5 4" strokeWidth={1.5}>
                    <ChartLabel value={`Upper ${upperDockLimit.toFixed(2)}'`} position="right" fill="#dc2626"
                      style={{ fontSize: 10, fontWeight: 700, fontFamily: "system-ui" }} />
                  </ReferenceLine>
                )}
                {lowerDockLimit != null && (
                  <ReferenceLine y={lowerDockLimit} stroke="#d97706" strokeDasharray="5 4" strokeWidth={1.5}>
                    <ChartLabel value={`Lower ${lowerDockLimit.toFixed(2)}'`} position="right" fill="#d97706"
                      style={{ fontSize: 10, fontWeight: 700, fontFamily: "system-ui" }} />
                  </ReferenceLine>
                )}
                <Line type="monotone" dataKey="elevation" stroke="hsl(var(--primary))" strokeWidth={2.5}
                  dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {upperDockLimit == null && (
            <p className="px-5 pb-3 text-[10px] text-muted-foreground font-sans italic">
              Log a dock move to overlay your upper and lower dock limits on the chart.
            </p>
          )}
        </div>
        );
      })()}

      {/* ── Weather forecast ──────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-border/50">
          <p className="text-xs font-bold font-sans uppercase tracking-wider text-muted-foreground">Forecast</p>
        </div>
        <div className="p-3 grid grid-cols-4 gap-2">
          {weather.map((day, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-background p-2 text-center">
              <p className="text-[11px] font-bold font-sans truncate">{i === 0 ? "Today" : day.name.slice(0, 3)}</p>
              <p className="text-xl font-serif leading-tight mt-1">{day.highTemp}°</p>
              {day.rainProbability > 0 ? (
                <p className={`text-[10px] font-semibold mt-1 ${day.rainProbability > 60 ? "text-amber-700" : "text-blue-600"}`}>
                  {day.rainProbability}% 🌧
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1 truncate">{day.shortForecast.split(" ")[0]}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LimitChip({
  label, value, fallbackLabel, fallbackValue, direction, statusText,
}: {
  label: string; value: number | null; fallbackLabel: string; fallbackValue: number;
  direction: "up" | "down"; statusText: string;
}) {
  const display = value ?? fallbackValue;
  const isNegative = display < 0;
  const Icon = direction === "up" ? ArrowUp : ArrowDown;
  return (
    <div className="rounded-xl border border-current/10 bg-white/60 px-3 py-2.5">
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className={`w-3.5 h-3.5 ${statusText}`} />
        <p className={`text-[9px] uppercase tracking-wider font-sans font-semibold ${statusText} opacity-80`}>
          {value != null ? label : fallbackLabel}
        </p>
      </div>
      <p className={`font-serif text-2xl font-bold ${isNegative ? "text-red-600" : statusText}`}>
        {isNegative ? "−" : ""}{Math.abs(display).toFixed(1)}'
      </p>
      {isNegative && (
        <p className="text-[9px] text-red-600 font-sans mt-0.5 font-semibold">PAST LIMIT</p>
      )}
    </div>
  );
}
