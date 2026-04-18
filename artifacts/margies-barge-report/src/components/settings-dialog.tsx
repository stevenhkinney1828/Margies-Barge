import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

type SummaryState = "idle" | "sending" | "sent" | "error";

export function SettingsDialog() {
  const { data: settings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState("");
  const [summaryState, setSummaryState] = useState<SummaryState>("idle");
  const [summaryError, setSummaryError] = useState("");

  useEffect(() => {
    if (settings && isOpen) {
      setEmails(settings.familyEmails.join(", "));
      setSummaryState("idle");
      setSummaryError("");
    }
  }, [settings, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    await updateSettings.mutateAsync({
      data: {
        safeLow: settings.safeLow,
        safeHigh: settings.safeHigh,
        familyEmails: emails.split(",").map((e) => e.trim()).filter(Boolean),
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    setIsOpen(false);
  };

  const handleSendSummary = async () => {
    setSummaryState("sending");
    setSummaryError("");
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}api/email/monday-summary`, { method: "POST" });
      const json = await res.json() as { sent: boolean; error?: string; recipients?: number };
      if (json.sent) {
        setSummaryState("sent");
      } else {
        setSummaryState("error");
        setSummaryError(json.error ?? "Unknown error");
      }
    } catch (err) {
      setSummaryState("error");
      setSummaryError(err instanceof Error ? err.message : "Network error");
    }
  };

  const savedEmailCount = settings?.familyEmails.length ?? 0;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20 rounded-full">
          <SettingsIcon className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        {/* Family emails */}
        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div className="space-y-2">
            <Label htmlFor="emails">Family Emails</Label>
            <Input
              id="emails"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              placeholder="john@example.com, jane@example.com"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated. These get urgent issue alerts and booking removal notices automatically.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving…" : "Save"}
          </Button>
        </form>

        {/* Monday summary */}
        <div className="border-t pt-4 space-y-2">
          <p className="text-sm font-semibold font-sans">Monday Morning Summary</p>
          <p className="text-xs text-muted-foreground">
            Sends a full status report — lake level, tasks, issues, and upcoming bookings — to all{savedEmailCount > 0 ? ` ${savedEmailCount}` : ""} family email{savedEmailCount !== 1 ? "s" : ""}.
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
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleSendSummary}
            disabled={summaryState === "sending" || savedEmailCount === 0}
          >
            {summaryState === "sending" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
            ) : (
              <><Mail className="w-4 h-4 mr-2" />Send Monday Summary Now</>
            )}
          </Button>

          {savedEmailCount === 0 && (
            <p className="text-xs text-amber-700">Add at least one email address above and save first.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
