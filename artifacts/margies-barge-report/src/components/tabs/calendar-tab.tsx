import {
  useListBookings,
  useCreateBooking,
  useDeleteBooking,
  getListBookingsQueryKey,
  type Booking,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Loader2 } from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmt(str: string, fmt_: string): string {
  const d = parseDate(str);
  const months = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];
  const short  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return fmt_
    .replace("MMMM", months[d.getMonth()])
    .replace("MMM",  short[d.getMonth()])
    .replace("yyyy", String(d.getFullYear()))
    .replace("d",    String(d.getDate()));
}

function buildWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(first.getDay()).fill(null);
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

type Segment = {
  booking: Booking;
  weekIndex: number;
  startCol: number;
  endCol: number;
  lane: number;
};

function getSegments(bookings: Booking[], weeks: (Date | null)[][]): Segment[] {
  const raw: Omit<Segment, "lane">[] = [];

  for (const booking of bookings) {
    const bStart = parseDate(booking.startDate);
    const bEnd   = parseDate(booking.endDate);
    for (let wi = 0; wi < weeks.length; wi++) {
      let sc = -1, ec = -1;
      for (let di = 0; di < 7; di++) {
        const day = weeks[wi][di];
        if (!day) continue;
        if (day >= bStart && day <= bEnd) {
          if (sc === -1) sc = di;
          ec = di;
        }
      }
      if (sc !== -1) raw.push({ booking, weekIndex: wi, startCol: sc, endCol: ec });
    }
  }

  // Assign vertical lanes within each week
  const segs: Segment[] = raw.map(s => ({ ...s, lane: 0 }));
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    for (let lane = 0; ; lane++) {
      const conflict = segs.slice(0, i).some(
        o => o.weekIndex === s.weekIndex && o.lane === lane &&
             !(o.endCol < s.startCol || o.startCol > s.endCol)
      );
      if (!conflict) { s.lane = lane; break; }
    }
  }
  return segs;
}

function lanesInWeek(segs: Segment[], wi: number): number {
  const lanes = segs.filter(s => s.weekIndex === wi).map(s => s.lane);
  return lanes.length === 0 ? 0 : Math.max(...lanes) + 1;
}

// ── Booking detail sheet ──────────────────────────────────────────────────

function BookingSheet({
  booking,
  onClose,
  onDelete,
  deleting,
}: {
  booking: Booking;
  onClose: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const startStr = fmt(booking.startDate, "MMM d");
  const endStr   = fmt(booking.endDate,   "MMM d");
  const year     = parseDate(booking.endDate).getFullYear();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl px-6 pt-5 pb-8 max-w-[430px] mx-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="font-serif text-2xl font-semibold text-foreground leading-tight">
              {booking.personName}
            </p>
            <p className="text-sm text-muted-foreground font-sans mt-1">
              {startStr} – {endStr}, {year}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-muted hover:bg-muted/80 text-muted-foreground -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Delete */}
        <div className="border-t border-border pt-4">
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors font-sans"
            >
              <Trash2 className="w-4 h-4" />
              Remove this visit
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Button
                variant="destructive" size="sm"
                onClick={onDelete}
                disabled={deleting}
                className="h-8 text-xs"
              >
                {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm remove"}
              </Button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs text-muted-foreground font-sans hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Add Visit dialog ──────────────────────────────────────────────────────

function AddVisitDialog() {
  const queryClient   = useQueryClient();
  const createBooking = useCreateBooking();
  const [isOpen, setIsOpen]               = useState(false);
  const [personName, setPersonName]       = useState("");
  const [startDate, setStartDate]         = useState("");
  const [endDate, setEndDate]             = useState("");
  const [spokeWithUncles, setUncles]      = useState(false);
  const [spokeWithCousins, setCousins]    = useState(false);
  const [formError, setFormError]         = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !startDate || !endDate) return;
    if (!spokeWithUncles || !spokeWithCousins) {
      setFormError("Please check both house rules before booking.");
      return;
    }
    setFormError("");
    try {
      await createBooking.mutateAsync({
        data: { personName, startDate, endDate, spokeWithUncles, spokeWithCousins },
      });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      setIsOpen(false);
      setPersonName(""); setStartDate(""); setEndDate("");
      setUncles(false); setCousins(false);
    } catch {
      setFormError("Something went wrong. Please try again.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-8 gap-1 font-sans text-xs">
          <Plus className="w-4 h-4" /> Add Visit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Schedule a Visit</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="personName">Who is visiting?</Label>
            <Input id="personName" value={personName} onChange={e => setPersonName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Arrival</Label>
              <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Departure</Label>
              <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="bg-muted/50 p-4 rounded-md border border-border space-y-3">
            <p className="text-sm font-medium">House Rules Checklist</p>
            <div className="flex items-start space-x-3">
              <Checkbox id="uncles" checked={spokeWithUncles} onCheckedChange={c => setUncles(!!c)} />
              <label htmlFor="uncles" className="text-sm leading-none mt-0.5">
                I have cleared this with the Uncles
              </label>
            </div>
            <div className="flex items-start space-x-3">
              <Checkbox id="cousins" checked={spokeWithCousins} onCheckedChange={c => setCousins(!!c)} />
              <label htmlFor="cousins" className="text-sm leading-none mt-0.5">
                I have notified the Cousins text thread
              </label>
            </div>
          </div>
          {formError && (
            <p className="text-sm text-destructive font-sans bg-destructive/10 px-3 py-2 rounded-md border border-destructive/20">
              {formError}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-11 font-serif text-base"
            disabled={createBooking.isPending}
          >
            {createBooking.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Calendar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main calendar grid ────────────────────────────────────────────────────

const DAY_NUM_HEIGHT = 26; // px reserved for the day number row
const BAR_HEIGHT     = 20; // px per booking bar
const BAR_GAP        = 3;  // px between stacked bars
const CELL_PAD_TOP   = 4;  // px above day numbers

export function CalendarTab() {
  const { data: bookings, isLoading } = useListBookings();
  const queryClient  = useQueryClient();
  const deleteBooking = useDeleteBooking();

  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-based
  const [selected,  setSelected]  = useState<Booking | null>(null);
  const [deleting,  setDeleting]  = useState(false);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const MONTH_NAMES = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];

  const weeks = buildWeeks(viewYear, viewMonth);
  const segs  = getSegments(bookings ?? [], weeks);

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteBooking.mutateAsync({ id: selected.id });
      queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
      setSelected(null);
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center pt-16">
      <Loader2 className="w-7 h-7 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="pb-8">
      {/* Header row: nav + add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-foreground active:bg-muted"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-serif text-lg font-semibold w-36 text-center select-none">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Next month"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted text-foreground active:bg-muted"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <AddVisitDialog />
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center text-[10px] font-bold font-sans uppercase tracking-wide text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="border border-border rounded-xl overflow-hidden">
        {weeks.map((week, wi) => {
          const lanes = lanesInWeek(segs, wi);
          const rowHeight = CELL_PAD_TOP + DAY_NUM_HEIGHT + (lanes > 0 ? lanes * (BAR_HEIGHT + BAR_GAP) + BAR_GAP : 6);
          const weekSegs  = segs.filter(s => s.weekIndex === wi);

          return (
            <div
              key={wi}
              className="relative grid grid-cols-7 border-b border-border last:border-b-0"
              style={{ minHeight: rowHeight }}
            >
              {/* Day number cells */}
              {week.map((day, di) => {
                const isToday = day &&
                  day.getDate() === today.getDate() &&
                  day.getMonth() === today.getMonth() &&
                  day.getFullYear() === today.getFullYear();
                const isCurrentMonth = day !== null;

                return (
                  <div
                    key={di}
                    className={`border-r border-border last:border-r-0 ${isCurrentMonth ? "bg-white" : "bg-muted/20"}`}
                  >
                    <div className="flex justify-center pt-1">
                      {day && (
                        <span
                          className={`text-xs font-sans w-5 h-5 flex items-center justify-center rounded-full leading-none select-none
                            ${isToday
                              ? "bg-primary text-white font-bold"
                              : "text-muted-foreground"
                            }`}
                        >
                          {day.getDate()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Booking bars — absolutely positioned over the week row */}
              {weekSegs.map((seg) => {
                const colW   = 100 / 7;
                const left   = `${seg.startCol * colW}%`;
                const width  = `${(seg.endCol - seg.startCol + 1) * colW}%`;
                const top    = CELL_PAD_TOP + DAY_NUM_HEIGHT + seg.lane * (BAR_HEIGHT + BAR_GAP) + BAR_GAP;
                const isSelected = selected?.id === seg.booking.id;

                return (
                  <button
                    key={`${seg.booking.id}-${wi}`}
                    onClick={() => setSelected(seg.booking)}
                    className="absolute flex items-center overflow-hidden cursor-pointer group"
                    style={{
                      left: `calc(${left} + 1px)`,
                      width: `calc(${width} - 2px)`,
                      top,
                      height: BAR_HEIGHT,
                      padding: "0 6px",
                      background: isSelected ? "#0f2a47" : "#1e3a5f",
                      borderRadius: 4,
                    }}
                  >
                    <span className="text-white text-[10px] font-sans font-semibold truncate leading-none">
                      {seg.booking.personName}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Booking detail sheet */}
      {selected && (
        <BookingSheet
          booking={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  );
}
