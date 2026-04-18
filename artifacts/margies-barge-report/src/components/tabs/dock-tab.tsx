import { useGetDashboard, useCreateDockAdjustment, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Droplets, Anchor, AlertTriangle, CheckCircle2, History } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function DockTab() {
  const { data: dashboard, isLoading, error } = useGetDashboard();
  const queryClient = useQueryClient();
  const createDockAdjustment = useCreateDockAdjustment();
  const [isOpen, setIsOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [workDate, setWorkDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [clearanceUp, setClearanceUp] = useState("");
  const [clearanceDown, setClearanceDown] = useState("");

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (error || !dashboard) return <div className="p-4 text-destructive">Failed to load dashboard</div>;

  const { lakeLevel, weather, lastDockAdjustment, lakeHistory, settings } = dashboard;

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !clearanceUp || !clearanceDown) return;
    
    await createDockAdjustment.mutateAsync({
      data: {
        personName,
        workDate,
        clearanceUp: Number(clearanceUp),
        clearanceDown: Number(clearanceDown)
      }
    });
    
    queryClient.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    setIsOpen(false);
    setPersonName("");
    setClearanceUp("");
    setClearanceDown("");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ALL CLEAR": return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "WARNING": return "text-amber-600 bg-amber-50 border-amber-200";
      case "DANGER": return "text-destructive bg-destructive/10 border-destructive/20";
      default: return "text-muted-foreground bg-muted border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ALL CLEAR": return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case "WARNING": return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case "DANGER": return <AlertTriangle className="w-5 h-5 text-destructive" />;
      default: return <Droplets className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Lake Level Status Card */}
      <Card className={`border shadow-sm overflow-hidden ${getStatusColor(lakeLevel.status)}`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-1">
                {getStatusIcon(lakeLevel.status)}
                <h2 className="font-sans font-bold tracking-tight uppercase text-sm">{lakeLevel.status}</h2>
              </div>
              <div className="text-4xl font-serif mt-2 tracking-tight">
                {lakeLevel.elevation.toFixed(2)}'
              </div>
              <p className="text-xs opacity-80 mt-1 font-sans">
                Full pool is 1071.00' • {lakeLevel.stale ? "Data may be stale" : `Updated ${format(new Date(lakeLevel.pulledAt), "h:mm a")}`}
              </p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-current/10 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-sans uppercase tracking-wider opacity-70 mb-1">Clearance Up</p>
              <p className="font-serif text-lg">{lakeLevel.clearanceUp.toFixed(1)}'</p>
            </div>
            <div>
              <p className="text-[10px] font-sans uppercase tracking-wider opacity-70 mb-1">Clearance Down</p>
              <p className="font-serif text-lg">{lakeLevel.clearanceDown.toFixed(1)}'</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dock Status & Actions */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-serif flex items-center space-x-2">
            <Anchor className="w-5 h-5 text-primary" />
            <span>Dock Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 rounded-lg p-4 mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-sans font-semibold mb-1">Last Moved</p>
            {lastDockAdjustment ? (
              <div>
                <p className="font-serif text-lg">{format(new Date(lastDockAdjustment.workDate), "MMM d, yyyy")}</p>
                <p className="text-sm text-muted-foreground mt-0.5">by {lastDockAdjustment.personName}</p>
                {lastDockAdjustment.clearanceUp != null && lastDockAdjustment.clearanceDown != null && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider font-sans text-amber-700">Logged Up</p>
                      <p className="font-serif text-base text-amber-800">{lastDockAdjustment.clearanceUp.toFixed(1)}'</p>
                    </div>
                    <div className="rounded-md bg-red-50 border border-red-100 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider font-sans text-red-700">Logged Down</p>
                      <p className="font-serif text-base text-red-800">{lastDockAdjustment.clearanceDown.toFixed(1)}'</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">No recent adjustments logged.</p>
            )}
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="w-full h-12 text-base font-serif" size="lg">Log Dock Move</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle className="font-serif text-xl">Log Dock Adjustment</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdjust} className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  No need to look up today&apos;s lake level — the app pulls that automatically. Just log when the dock was moved and the clearance you saw.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="personName">Who moved it?</Label>
                  <Input 
                    id="personName" 
                    value={personName} 
                    onChange={(e) => setPersonName(e.target.value)} 
                    placeholder="e.g. Uncle John" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workDate">When?</Label>
                  <Input 
                    id="workDate" 
                    type="date" 
                    value={workDate} 
                    onChange={(e) => setWorkDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="clearanceUp">Feet up</Label>
                    <Input
                      id="clearanceUp"
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={clearanceUp}
                      onChange={(e) => setClearanceUp(e.target.value)}
                      placeholder="5.0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clearanceDown">Feet down</Label>
                    <Input
                      id="clearanceDown"
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={clearanceDown}
                      onChange={(e) => setClearanceDown(e.target.value)}
                      placeholder="6.0"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={createDockAdjustment.isPending}>
                  {createDockAdjustment.isPending ? "Logging..." : "Save Adjustment"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Lake History Chart */}
      {lakeHistory && lakeHistory.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-serif flex items-center space-x-2">
              <History className="w-5 h-5 text-primary" />
              <span>7-Day Trend</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] pt-4 pl-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lakeHistory.slice().reverse()} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(val) => format(new Date(val), "E")} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  dy={10}
                />
                <YAxis 
                  domain={['dataMin - 0.5', 'dataMax + 0.5']} 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickFormatter={(val) => val.toFixed(1)}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px' }}
                  labelFormatter={(val) => format(new Date(val), "MMM d")}
                  formatter={(val: number) => [`${val.toFixed(2)}'`, 'Elevation']}
                />
                <ReferenceLine y={settings.safeLow} stroke="var(--destructive)" strokeDasharray="3 3" opacity={0.3} />
                <ReferenceLine y={settings.safeHigh} stroke="var(--destructive)" strokeDasharray="3 3" opacity={0.3} />
                <Line 
                  type="monotone" 
                  dataKey="elevation" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={{ r: 3, fill: "hsl(var(--primary))" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Weather Forecast */}
      <Card className="shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 py-3 border-b border-border/50">
          <CardTitle className="text-sm font-sans uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
            <span>Forecast</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-2">
            {weather.map((day, i) => (
              <div key={i} className="rounded-lg border border-border/60 bg-background p-2 text-center min-h-[78px]">
                <p className="text-[11px] font-bold font-sans truncate">{i === 0 ? "Today" : day.name.slice(0, 3)}</p>
                <p className="text-lg font-serif leading-tight mt-1">{day.highTemp}°</p>
                {day.rainProbability > 0 ? (
                  <p className={`text-[10px] font-semibold mt-1 ${day.rainProbability > 60 ? "text-amber-700" : "text-blue-600"}`}>
                    {day.rainProbability}% rain
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground mt-1 truncate">{day.shortForecast}</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
