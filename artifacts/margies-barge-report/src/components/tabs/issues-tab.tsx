import { useListIssues, useCreateIssue, useResolveIssue, getListIssuesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Wrench, Plus, Camera, Image as ImageIcon, CheckCircle2, Info, X, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function IssuesTab() {
  const { data: issues, isLoading } = useListIssues();
  const queryClient = useQueryClient();
  const createIssue = useCreateIssue();
  const resolveIssue = useResolveIssue();
  
  const [isOpen, setIsOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [personName, setPersonName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const apiBase = import.meta.env.BASE_URL + "api";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const reqRes = await fetch(`${apiBase}/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!reqRes.ok) throw new Error(`Could not get upload URL (${reqRes.status})`);
      const { uploadURL, objectPath } = await reqRes.json() as { uploadURL: string; objectPath: string };
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);
      setPhotoUrl(`${apiBase}/storage${objectPath}`);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setCaption("");
    setPersonName("");
    setPhotoUrl("");
    setUploadError(null);
    setUrgent(false);
  };

  const [resolveOpen, setResolveOpen] = useState<{isOpen: boolean, issue: any}>({isOpen: false, issue: null});
  const [resolvePerson, setResolvePerson] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption || !personName) return;
    
    await createIssue.mutateAsync({
      data: { caption, personName, photoUrl: photoUrl || "", urgent }
    });

    queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
    setIsOpen(false);
    resetForm();
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveOpen.issue || !resolvePerson || !resolutionNote) return;
    
    await resolveIssue.mutateAsync({
      id: resolveOpen.issue.id,
      data: { personName: resolvePerson, resolutionNote }
    });
    
    queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
    setResolveOpen({isOpen: false, issue: null});
    setResolvePerson("");
    setResolutionNote("");
  };

  const openIssues = issues?.filter(i => i.status === "open") || [];
  const resolvedIssues = issues?.filter(i => i.status === "resolved") || [];

  return (
    <div className="pb-8">
      <div className="flex justify-between items-center mb-6 px-1">
        <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground">House & Dock Issues</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="destructive" className="h-8 gap-1"><Plus className="w-4 h-4"/> Report Issue</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5"/>
                Report an Issue
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="caption">What's wrong?</Label>
                <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="e.g. Guest bathroom toilet is running" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personName">Reported by</Label>
                <Input id="personName" value={personName} onChange={(e) => setPersonName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Photo (optional)</Label>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                  className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                <input ref={libraryInputRef} type="file" accept="image/*"
                  className="hidden" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                {photoUrl ? (
                  <div className="relative rounded-lg overflow-hidden border border-border">
                    <img src={photoUrl} alt="Issue preview" className="w-full max-h-56 object-cover" />
                    <button type="button" onClick={() => setPhotoUrl("")}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 shadow"
                      aria-label="Remove photo">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" disabled={uploading}
                      onClick={() => cameraInputRef.current?.click()} className="h-20 flex-col gap-1">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                      <span className="text-xs font-sans">Take Photo</span>
                    </Button>
                    <Button type="button" variant="outline" disabled={uploading}
                      onClick={() => libraryInputRef.current?.click()} className="h-20 flex-col gap-1">
                      {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                      <span className="text-xs font-sans">Choose Photo</span>
                    </Button>
                  </div>
                )}
                {uploadError && <p className="text-[11px] text-destructive">{uploadError}</p>}
              </div>
              <div className="flex items-start space-x-3 p-3 bg-destructive/10 rounded-md border border-destructive/20">
                <Checkbox id="urgent" checked={urgent} onCheckedChange={(c) => setUrgent(!!c)} />
                <label htmlFor="urgent" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive-foreground">
                  Mark as Urgent (Needs immediate attention)
                </label>
              </div>
              <Button type="submit" variant="destructive" className="w-full" disabled={createIssue.isPending || uploading}>
                {uploading ? "Uploading photo…" : "Submit Report"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {openIssues.length > 0 ? (
        <div className="space-y-4 mb-8">
          {openIssues.map(issue => (
            <Card key={issue.id} className={`shadow-sm overflow-hidden ${issue.urgent ? 'border-destructive ring-1 ring-destructive/20' : ''}`}>
              {issue.photoUrl && (
                <div className="w-full h-32 bg-muted relative">
                  <img src={issue.photoUrl} alt="Issue photo" className="w-full h-full object-cover" />
                  {issue.urgent && (
                    <Badge variant="destructive" className="absolute top-2 right-2 shadow-sm">Urgent</Badge>
                  )}
                </div>
              )}
              <CardContent className={`p-4 ${!issue.photoUrl && issue.urgent ? 'pt-5' : ''}`}>
                {!issue.photoUrl && issue.urgent && (
                  <Badge variant="destructive" className="mb-2">Urgent</Badge>
                )}
                <p className="font-serif text-lg leading-snug mb-2">{issue.caption}</p>
                <div className="flex justify-between items-end mt-4">
                  <p className="text-xs text-muted-foreground">
                    Reported {format(new Date(issue.createdAt), "MMM d")} by {issue.personName}
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-8 text-xs font-sans font-medium"
                    onClick={() => setResolveOpen({isOpen: true, issue})}
                  >
                    <Wrench className="w-3 h-3 mr-1" /> Resolve
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed border-border mb-8">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-300 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No open issues. Looking good!</p>
        </div>
      )}

      {resolvedIssues.length > 0 && (
        <div>
          <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground mb-4 px-1">Recently Resolved</h2>
          <div className="space-y-3 opacity-75">
            {resolvedIssues.slice(0,5).map(issue => (
              <Card key={issue.id} className="bg-muted/30 border-transparent shadow-none">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium line-through decoration-muted-foreground/30">{issue.caption}</p>
                      <p className="text-xs mt-1 bg-white border border-border p-2 rounded text-muted-foreground italic">
                        "{issue.resolutionNote}"
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Fixed by {issue.resolvedBy} on {issue.resolvedAt ? format(new Date(issue.resolvedAt), "MMM d") : ''}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={resolveOpen.isOpen} onOpenChange={(open) => !open && setResolveOpen({isOpen: false, issue: null})}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <Wrench className="w-5 h-5"/>
              Mark as Resolved
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResolve} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="fixPerson">Who fixed it?</Label>
              <Input id="fixPerson" value={resolvePerson} onChange={(e) => setResolvePerson(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolutionNote">How was it fixed? / Notes</Label>
              <Textarea id="resolutionNote" value={resolutionNote} onChange={(e) => setResolutionNote(e.target.value)} placeholder="e.g. Replaced the flapper valve" required />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={resolveIssue.isPending}>
              Save & Resolve
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
