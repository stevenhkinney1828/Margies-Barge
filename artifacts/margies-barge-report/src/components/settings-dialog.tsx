import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Settings as SettingsIcon, Mail, MessageSquare, CheckCircle, XCircle, Loader2,
  Plus, Pencil, Trash2, Check,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type SummaryState = "idle" | "sending" | "sent" | "error";

interface FamilyMember {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  appAccess: boolean;
  notifications: boolean;
  mondayEmail: boolean;
}

// ── API helpers ───────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL + "api";

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok && res.status !== 204) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Add / Edit member form ────────────────────────────────────────────────────

function MemberForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: FamilyMember;
  onSave: (data: Omit<FamilyMember, "id">) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [name, setName]            = useState(initial?.name ?? "");
  const [email, setEmail]          = useState(initial?.email ?? "");
  const [phone, setPhone]          = useState(initial?.phone ?? "");
  const [appAccess, setAppAccess]  = useState(initial?.appAccess ?? false);
  const [notifications, setNotifs] = useState(initial?.notifications ?? false);
  const [mondayEmail, setMonday]   = useState(initial?.mondayEmail ?? false);

  const hasEmail = email.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name.trim(),
      email: hasEmail ? email.trim() : null,
      phone: phone.trim() || null,
      appAccess,
      notifications: hasEmail && notifications,
      mondayEmail: hasEmail && mondayEmail,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 bg-muted/30 space-y-3 mt-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Name</Label>
          <Input value={name} onChange={e => setName(e.target.value)} required className="h-9" placeholder="Jane" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Email (optional)</Label>
          <Input value={email} onChange={e => setEmail(e.target.value)} type="email" className="h-9" placeholder="jane@..." />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Phone (optional)</Label>
        <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="h-9" placeholder="(555) 867-5309" />
      </div>

      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-2.5">
          <Checkbox id="fa" checked={appAccess} onCheckedChange={c => setAppAccess(!!c)} />
          <label htmlFor="fa" className="text-xs font-sans leading-none cursor-pointer">App Access <span className="text-muted-foreground">(given URL & passcode)</span></label>
        </div>
        <div className={`flex items-center gap-2.5 ${!hasEmail ? "opacity-40" : ""}`}>
          <Checkbox id="fn" checked={notifications && hasEmail} onCheckedChange={c => setNotifs(!!c)} disabled={!hasEmail} />
          <label htmlFor="fn" className="text-xs font-sans leading-none cursor-pointer">Notifications <span className="text-muted-foreground">(calendar removals, urgent issues)</span></label>
        </div>
        <div className={`flex items-center gap-2.5 ${!hasEmail ? "opacity-40" : ""}`}>
          <Checkbox id="fm" checked={mondayEmail && hasEmail} onCheckedChange={c => setMonday(!!c)} disabled={!hasEmail} />
          <label htmlFor="fm" className="text-xs font-sans leading-none cursor-pointer">Monday Email <span className="text-muted-foreground">(weekly summary)</span></label>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving || !name.trim()}>
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
          {initial ? "Save Changes" : "Add Member"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Member row ────────────────────────────────────────────────────────────────

function MemberRow({
  member,
  onEdit,
  onDelete,
}: {
  member: FamilyMember;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 bg-white space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-sans text-sm font-semibold text-foreground">{member.name}</p>
          {member.email && <p className="font-sans text-xs text-muted-foreground">{member.email}</p>}
          {member.phone && <p className="font-sans text-xs text-muted-foreground">{member.phone}</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-sans font-medium ${member.appAccess ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          App Access{member.appAccess ? " ✓" : ""}
        </span>
        {member.email && (
          <>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-sans font-medium ${member.notifications ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"}`}>
              Notifs{member.notifications ? " ✓" : ""}
            </span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-sans font-medium ${member.mondayEmail ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground"}`}>
              Monday{member.mondayEmail ? " ✓" : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Quick Contact ─────────────────────────────────────────────────────────────

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

function isMobile(): boolean {
  return isIOS() || isAndroid() ||
    ("ontouchstart" in window && navigator.maxTouchPoints > 1);
}

function normalizePhone(phone: string): string {
  const hasLeadingPlus = phone.trimStart().startsWith("+");
  const digitsOnly = phone.replace(/\D/g, "");
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}

function QuickContact({ members }: { members: FamilyMember[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3500);
  };

  const selectAll  = () => setChecked(new Set(members.map(m => m.id)));
  const clearAll   = () => setChecked(new Set());

  const selectedMembers = members.filter(m => checked.has(m.id));

  const handleText = () => {
    const rawPhones = selectedMembers.map(m => m.phone).filter(Boolean) as string[];
    console.log("[QuickContact] raw phones collected:", rawPhones);
    setChecked(new Set());
    if (rawPhones.length === 0) {
      showFeedback("No phone numbers available for selected members.");
      return;
    }
    const phones = rawPhones.map(normalizePhone);
    console.log("[QuickContact] normalized phones:", phones);
    if (isMobile()) {
      const sep = isAndroid() ? ";" : ",";
      const url = `sms:${phones.join(sep)}`;
      console.log("[QuickContact] opening sms url:", url);
      window.location.href = url;
    } else {
      const display = rawPhones.join(", ");
      void navigator.clipboard.writeText(display)
        .then(() => {
          showFeedback("Phone numbers copied to clipboard — paste them into your messaging app.");
        })
        .catch(() => {
          showFeedback("Couldn't copy automatically — please copy these numbers manually: " + display);
        });
    }
  };

  const handleEmail = () => {
    const emails = selectedMembers.map(m => m.email).filter(Boolean) as string[];
    setChecked(new Set());
    if (emails.length === 0) {
      showFeedback("No email addresses available for selected members.");
      return;
    }
    window.location.href = `mailto:${emails.join(",")}`;
  };

  if (members.length === 0) return null;

  return (
    <div className="border-t pt-4 space-y-3 mt-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold font-sans">Quick Contact</p>
        <div className="flex gap-3">
          <button type="button" onClick={selectAll} className="text-xs text-primary underline-offset-2 hover:underline font-sans">
            Select All
          </button>
          <button type="button" onClick={clearAll} className="text-xs text-muted-foreground underline-offset-2 hover:underline font-sans">
            Clear All
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {members.map(m => (
          <div key={m.id} className="flex items-center gap-2.5 px-1 py-0.5">
            <Checkbox
              id={`qc-${m.id}`}
              checked={checked.has(m.id)}
              onCheckedChange={() => {
                setChecked(prev => {
                  const next = new Set(prev);
                  if (next.has(m.id)) {
                    next.delete(m.id);
                  } else {
                    next.add(m.id);
                  }
                  return next;
                });
              }}
            />
            <label htmlFor={`qc-${m.id}`} className="flex-1 min-w-0 cursor-pointer">
              <span className="text-sm font-sans font-medium text-foreground">{m.name}</span>
              {m.phone && (
                <span className="text-xs text-muted-foreground font-sans ml-2">{m.phone}</span>
              )}
            </label>
          </div>
        ))}
      </div>

      {feedback && (
        <p className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-2 font-sans">{feedback}</p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          type="button"
          className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={checked.size === 0}
          onClick={handleText}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Text Selected
        </Button>
        <Button
          type="button"
          className="h-9 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
          disabled={checked.size === 0}
          onClick={handleEmail}
        >
          <Mail className="w-3.5 h-3.5" />
          Email Selected
        </Button>
      </div>
    </div>
  );
}

// ── Main settings dialog ──────────────────────────────────────────────────────

export function SettingsDialog() {
  const [isOpen, setIsOpen]         = useState(false);
  const [members, setMembers]       = useState<FamilyMember[]>([]);
  const [loadingM, setLoadingM]     = useState(false);
  const [adding, setAdding]         = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [summaryState, setSumState] = useState<SummaryState>("idle");
  const [summaryError, setSumErr]   = useState("");
  const [testState, setTestState]   = useState<SummaryState>("idle");
  const [testError, setTestErr]     = useState("");

  const loadMembers = useCallback(async () => {
    setLoadingM(true);
    try {
      const data = await apiFetch("/family-members") as FamilyMember[];
      setMembers(data);
    } catch { /* ignore */ }
    finally { setLoadingM(false); }
  }, []);

  useEffect(() => {
    if (isOpen) {
      void loadMembers();
      setSumState("idle"); setSumErr("");
      setTestState("idle"); setTestErr("");
      setAdding(false); setEditingId(null);
    }
  }, [isOpen, loadMembers]);

  const handleAddMember = async (data: Omit<FamilyMember, "id">) => {
    setSaving(true);
    try {
      await apiFetch("/family-members", { method: "POST", body: JSON.stringify(data) });
      await loadMembers();
      setAdding(false);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleEditMember = async (id: number, data: Omit<FamilyMember, "id">) => {
    setSaving(true);
    try {
      await apiFetch(`/family-members/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      await loadMembers();
      setEditingId(null);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleDeleteMember = async (id: number) => {
    setSaving(true);
    try {
      await apiFetch(`/family-members/${id}`, { method: "DELETE" });
      await loadMembers();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const handleSendSummary = async () => {
    setSumState("sending"); setSumErr("");
    try {
      const res = await apiFetch("/email/monday-summary", { method: "POST" }) as { sent: boolean; error?: string; recipients?: number };
      if (res?.sent) { setSumState("sent"); }
      else { setSumState("error"); setSumErr(res?.error ?? "Unknown error"); }
    } catch (err) {
      setSumState("error"); setSumErr(err instanceof Error ? err.message : "Network error");
    }
  };

  const handleTestEmail = async () => {
    setTestState("sending"); setTestErr("");
    try {
      const res = await apiFetch("/email/test", { method: "POST" }) as { sent: boolean; error?: string; to?: string };
      if (res?.sent) { setTestState("sent"); }
      else { setTestState("error"); setTestErr(res?.error ?? "Unknown error"); }
    } catch (err) {
      setTestState("error"); setTestErr(err instanceof Error ? err.message : "Network error");
    }
  };

  const mondayCount = members.filter(m => m.mondayEmail && m.email).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full">
          <SettingsIcon className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        {/* ── Family Members ── */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold font-sans">Family Members</p>
            {!adding && (
              <Button
                type="button" size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => { setAdding(true); setEditingId(null); }}
              >
                <Plus className="w-3 h-3" /> Add Member
              </Button>
            )}
          </div>

          {adding && (
            <MemberForm
              onSave={handleAddMember}
              onCancel={() => setAdding(false)}
              saving={saving}
            />
          )}

          {loadingM ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground font-sans text-center py-3">
              No family members yet. Add one above.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                editingId === m.id ? (
                  <MemberForm
                    key={m.id}
                    initial={m}
                    onSave={data => handleEditMember(m.id, data)}
                    onCancel={() => setEditingId(null)}
                    saving={saving}
                  />
                ) : (
                  <MemberRow
                    key={m.id}
                    member={m}
                    onEdit={() => { setEditingId(m.id); setAdding(false); }}
                    onDelete={() => handleDeleteMember(m.id)}
                  />
                )
              ))}
            </div>
          )}
        </div>

        {/* ── Quick Contact ── */}
        {!loadingM && <QuickContact members={members} />}

        {/* ── Monday Summary ── */}
        <div className="border-t pt-4 space-y-2 mt-2">
          <p className="text-sm font-semibold font-sans">Monday Morning Summary</p>
          <p className="text-xs text-muted-foreground">
            Sends every Monday at 7 am to {mondayCount > 0 ? `${mondayCount} member${mondayCount !== 1 ? "s" : ""}` : "family members"} with Monday Email enabled.
          </p>

          {summaryState === "sent" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Summary sent!
            </div>
          )}
          {summaryState === "error" && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{summaryError}</span>
            </div>
          )}

          <Button
            type="button" variant="outline" className="w-full"
            onClick={handleSendSummary}
            disabled={summaryState === "sending" || mondayCount === 0}
          >
            {summaryState === "sending"
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              : <><Mail className="w-4 h-4 mr-2" />Send Monday Summary Now</>
            }
          </Button>

          {mondayCount === 0 && (
            <p className="text-xs text-amber-700">Add a member with Monday Email enabled first.</p>
          )}
        </div>

        {/* ── Test Email ── */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-semibold font-sans">Test Email</p>
          <p className="text-xs text-muted-foreground">
            Sends a preview of the Monday summary to the Gmail address configured on the server — just to you, not the family list.
          </p>

          {testState === "sent" && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              Test email sent! Check your inbox.
            </div>
          )}
          {testState === "error" && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{testError}</span>
            </div>
          )}

          <Button
            type="button" variant="outline" className="w-full"
            onClick={handleTestEmail}
            disabled={testState === "sending"}
          >
            {testState === "sending"
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              : <><Mail className="w-4 h-4 mr-2" />Send Test Email</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
