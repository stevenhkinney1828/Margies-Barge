import {
  useListTasks,
  useCompleteTask,
  useUpdateTask,
  useDeleteTask,
  useCreateTask,
  getListTasksQueryKey,
  Task,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CheckCircle2, AlertCircle, Clock, Snowflake,
  Pencil, Plus, Loader2, Trash2,
} from "lucide-react";

// ── Cadence presets ───────────────────────────────────────────────────────
const CADENCE_PRESETS = [
  { label: "Weekly",          days: 7 },
  { label: "Every 2 weeks",   days: 14 },
  { label: "Monthly",         days: 30 },
  { label: "Every 2 months",  days: 60 },
  { label: "Every 3 months",  days: 90 },
  { label: "Every 4 months",  days: 120 },
  { label: "Every 6 months",  days: 180 },
  { label: "Annually",        days: 365 },
  { label: "Custom…",         days: -1 },
] as const;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function presetForDays(days: number): number {
  const p = CADENCE_PRESETS.find((p) => p.days === days);
  return p ? p.days : -1;
}

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    overdue:  { label: "Overdue",   cls: "bg-red-100 text-red-700 border-red-200",     icon: <AlertCircle className="w-3 h-3" /> },
    "due-soon": { label: "Due Soon", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3 h-3" /> },
    seasonal: { label: "Seasonal",  cls: "bg-slate-100 text-slate-500 border-slate-200", icon: <Snowflake className="w-3 h-3" /> },
    good:     { label: "Good",      cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  };
  const s = map[status] ?? map.good;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold font-sans uppercase tracking-wide border rounded-full px-2 py-0.5 ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ── Edit / Add dialog ─────────────────────────────────────────────────────
type EditDialogProps = {
  task: Task | null;           // null = new task
  onClose: () => void;
};

function TaskEditDialog({ task, onClose }: EditDialogProps) {
  const queryClient = useQueryClient();
  const updateTask  = useUpdateTask();
  const deleteTask  = useDeleteTask();
  const createTask  = useCreateTask();

  const [icon,        setIcon]        = useState(task?.icon ?? "🔧");
  const [name,        setName]        = useState(task?.name ?? "");
  const [cadenceSel,  setCadenceSel]  = useState<number>(() => presetForDays(task?.cadenceDays ?? 30));
  const [customDays,  setCustomDays]  = useState(String(task?.cadenceDays ?? 30));
  const [monthNums,   setMonthNums]   = useState<number[]>(task?.activeMonthNums ?? []);
  const [lastDone,    setLastDone]    = useState(task?.lastDoneDate ?? "");
  const [lastBy,      setLastBy]      = useState(task?.lastDoneBy ?? "");
  const [notes,       setNotes]       = useState(task?.notes ?? "");
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [saving,      setSaving]      = useState(false);

  const finalDays = cadenceSel === -1 ? Number(customDays) || 30 : cadenceSel;

  const toggleMonth = (m: number) =>
    setMonthNums((prev) => prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m].sort((a,b) => a-b));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (task) {
        await updateTask.mutateAsync({
          id: task.id,
          data: {
            icon: icon.trim() || "🔧",
            name: name.trim(),
            cadenceDays: finalDays,
            activeMonthNums: monthNums,
            lastDoneDate: lastDone || null,
            lastDoneBy: lastBy || null,
            notes: notes.trim() || null,
          },
        });
      } else {
        await createTask.mutateAsync({
          data: {
            icon: icon.trim() || "🔧",
            name: name.trim(),
            cadenceDays: finalDays,
            activeMonthNums: monthNums,
            notes: notes.trim() || null,
          },
        });
      }
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await deleteTask.mutateAsync({ id: task.id });
      queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 mt-2 pb-1">
      {/* Icon + Name */}
      <div className="flex gap-3 items-start">
        <div className="space-y-1 shrink-0">
          <Label htmlFor="icon" className="text-xs">Icon</Label>
          <Input
            id="icon"
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="w-14 text-center text-xl"
            maxLength={4}
          />
        </div>
        <div className="space-y-1 flex-1">
          <Label htmlFor="name">Task name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bug Spray" required />
        </div>
      </div>

      {/* Cadence */}
      <div className="space-y-2">
        <Label>How often?</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {CADENCE_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setCadenceSel(p.days)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-sans font-medium transition-colors ${
                cadenceSel === p.days
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {cadenceSel === -1 && (
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number" min="1" value={customDays}
              onChange={(e) => setCustomDays(e.target.value)}
              className="w-24" inputMode="numeric"
            />
            <span className="text-sm text-muted-foreground">days</span>
          </div>
        )}
      </div>

      {/* Active months */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label>Active months</Label>
          <button
            type="button"
            className="text-xs text-primary underline-offset-2 hover:underline"
            onClick={() => setMonthNums(monthNums.length === 0 ? [] : [])}
          >
            {monthNums.length === 0 ? "All year selected" : "Clear (all year)"}
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MONTHS.map((label, i) => {
            const m = i + 1;
            const selected = monthNums.includes(m);
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggleMonth(m)}
                className={`rounded-lg border py-2 text-xs font-sans font-medium transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : monthNums.length === 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground font-sans">
          {monthNums.length === 0
            ? "Shows every month. Overdue tasks always show regardless."
            : `Active in: ${monthNums.map((m) => MONTHS[m - 1]).join(", ")}. Overdue tasks always show even outside these months.`}
        </p>
      </div>

      {/* Last completed */}
      <div className="space-y-2">
        <Label>Last completed</Label>
        <div className="grid grid-cols-2 gap-3">
          <Input type="date" value={lastDone} onChange={(e) => setLastDone(e.target.value)} />
          <Input placeholder="By who?" value={lastBy} onChange={(e) => setLastBy(e.target.value)} />
        </div>
        <p className="text-[10px] text-muted-foreground font-sans">Leave blank if never done — it will show as overdue.</p>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any reminders or context…" />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        {task && !confirmDel && (
          <Button
            type="button" variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setConfirmDel(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />Delete
          </Button>
        )}
        {task && confirmDel && (
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm delete"}
          </Button>
        )}
        <Button type="submit" className="flex-1 font-serif text-base h-11" disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : task ? "Save Changes" : "Add Task"}
        </Button>
      </div>
    </form>
  );
}

// ── Mark Done dialog ──────────────────────────────────────────────────────
function MarkDoneDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const [personName, setPersonName] = useState("");
  const [workDate,   setWorkDate]   = useState(format(new Date(), "yyyy-MM-dd"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName) return;
    await completeTask.mutateAsync({ id: task.id, data: { personName, workDate } });
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label htmlFor="personName">Who did it?</Label>
        <Input id="personName" value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="e.g. Aunt Sarah" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="workDate">When?</Label>
        <Input id="workDate" type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full h-11 font-serif text-base" disabled={completeTask.isPending}>
        {completeTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Mark as Done"}
      </Button>
    </form>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────
function TaskCard({ task, onEdit, onMarkDone }: { task: Task; onEdit: () => void; onMarkDone: () => void }) {
  const urgent = task.status === "overdue" || task.status === "due-soon";
  return (
    <div className={`rounded-xl border bg-card overflow-hidden mb-3 ${urgent ? "border-border shadow-sm" : "border-border/60"}`}>
      <div className="flex items-stretch">
        {/* Icon column */}
        <div className="w-14 bg-muted/30 flex items-center justify-center text-2xl border-r border-border/50 shrink-0">
          {task.icon}
        </div>

        {/* Body */}
        <div className="p-3 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-serif font-medium text-base leading-tight truncate">{task.name}</h3>
            <StatusBadge status={task.status} />
          </div>

          <p className="text-xs text-muted-foreground font-sans">{task.cadenceLabel}</p>

          {task.lastDoneDate ? (
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Last: {format(new Date(task.lastDoneDate + "T12:00:00"), "MMM d, yyyy")}
              {task.lastDoneBy ? ` · ${task.lastDoneBy}` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground font-sans mt-0.5 italic">Never completed</p>
          )}

          {task.nextDueDate && task.status !== "overdue" && (
            <p className="text-xs text-muted-foreground font-sans mt-0.5">
              Next due: {format(new Date(task.nextDueDate + "T12:00:00"), "MMM d, yyyy")}
            </p>
          )}

          {task.notes && (
            <p className="text-xs mt-2 bg-muted/50 px-2 py-1.5 rounded text-muted-foreground border border-border/50 italic">
              {task.notes}
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5 mr-1" />Edit
            </Button>
            <Button
              variant={urgent ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 font-sans font-medium text-xs"
              onClick={onMarkDone}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Mark Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────
type DialogMode =
  | { type: "none" }
  | { type: "edit"; task: Task }
  | { type: "add" }
  | { type: "done"; task: Task };

export function TasksTab() {
  const { data: tasks, isLoading } = useListTasks();
  const [dialog, setDialog] = useState<DialogMode>({ type: "none" });

  if (isLoading) return (
    <div className="flex justify-center items-center pt-16">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  const overdue  = tasks?.filter((t) => t.status === "overdue")   ?? [];
  const dueSoon  = tasks?.filter((t) => t.status === "due-soon")  ?? [];
  const good     = tasks?.filter((t) => t.status === "good")      ?? [];
  const seasonal = tasks?.filter((t) => t.status === "seasonal")  ?? [];

  const Section = ({ title, items }: { title: string; items: Task[] }) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-5">
        <p className="text-xs font-bold font-sans uppercase tracking-widest text-muted-foreground mb-3 px-0.5">{title}</p>
        {items.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            onEdit={() => setDialog({ type: "edit", task: t })}
            onMarkDone={() => setDialog({ type: "done", task: t })}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="pb-8">
      {/* Add task button */}
      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" className="h-9 font-sans text-xs" onClick={() => setDialog({ type: "add" })}>
          <Plus className="w-4 h-4 mr-1" />Add Task
        </Button>
      </div>

      <Section title="Needs Attention" items={[...overdue, ...dueSoon]} />
      <Section title="Up to Date"      items={good} />
      <Section title="Out of Season"   items={seasonal} />

      {tasks?.length === 0 && (
        <div className="text-center pt-12 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-200 mb-3" />
          <p className="font-serif text-lg">No tasks yet</p>
          <p className="text-sm font-sans mt-1">Tap "Add Task" to create your first one.</p>
        </div>
      )}

      {/* Edit / Add dialog */}
      <Dialog
        open={dialog.type === "edit" || dialog.type === "add"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="sm:max-w-[420px] max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              {dialog.type === "add"
                ? "Add New Task"
                : dialog.type === "edit"
                ? `Edit — ${dialog.task.name}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          <TaskEditDialog
            task={dialog.type === "edit" ? dialog.task : null}
            onClose={() => setDialog({ type: "none" })}
          />
        </DialogContent>
      </Dialog>

      {/* Mark Done dialog */}
      <Dialog
        open={dialog.type === "done"}
        onOpenChange={(open) => !open && setDialog({ type: "none" })}
      >
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <span>{dialog.type === "done" ? dialog.task.icon : ""}</span>
              <span>Mark Done — {dialog.type === "done" ? dialog.task.name : ""}</span>
            </DialogTitle>
          </DialogHeader>
          {dialog.type === "done" && (
            <MarkDoneDialog
              task={dialog.task}
              onClose={() => setDialog({ type: "none" })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
