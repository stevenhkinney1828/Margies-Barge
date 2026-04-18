import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function SettingsDialog() {
  const { data: settings } = useGetSettings();
  const updateSettings = useUpdateSettings();
  const queryClient = useQueryClient();
  
  const [isOpen, setIsOpen] = useState(false);
  const [safeLow, setSafeLow] = useState("");
  const [safeHigh, setSafeHigh] = useState("");
  const [emails, setEmails] = useState("");

  useEffect(() => {
    if (settings && isOpen) {
      setSafeLow(settings.safeLow.toString());
      setSafeHigh(settings.safeHigh.toString());
      setEmails(settings.familyEmails.join(", "));
    }
  }, [settings, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    
    await updateSettings.mutateAsync({
      data: {
        safeLow: parseFloat(safeLow) || settings.safeLow,
        safeHigh: parseFloat(safeHigh) || settings.safeHigh,
        familyEmails: emails.split(",").map(e => e.trim()).filter(Boolean)
      }
    });
    
    queryClient.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
    setIsOpen(false);
  };

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
            App Settings
          </DialogTitle>
        </DialogHeader>
        
        <Alert className="bg-muted border-border">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Email integration is currently pending. Changing emails here will save to the database, but email notifications are not yet active.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-3">
            <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground border-b pb-1">Lake Thresholds</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="safeLow">Safe Low (ft)</Label>
                <Input id="safeLow" type="number" step="0.1" value={safeLow} onChange={(e) => setSafeLow(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="safeHigh">Safe High (ft)</Label>
                <Input id="safeHigh" type="number" step="0.1" value={safeHigh} onChange={(e) => setSafeHigh(e.target.value)} required />
              </div>
            </div>
          </div>
          
          <div className="space-y-3 mt-6">
            <h3 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground border-b pb-1">Notifications</h3>
            <div className="space-y-2">
              <Label htmlFor="emails">Family Emails (comma separated)</Label>
              <Input id="emails" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="john@example.com, jane@example.com" />
            </div>
          </div>
          
          <Button type="submit" className="w-full mt-6" disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
