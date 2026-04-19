import { useState, useEffect } from "react";
import { Anchor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PASSCODE = "9530";
const STORAGE_KEY = "mbr_auth";

export function PasscodeGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [entry, setEntry]       = useState("");
  const [error, setError]       = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === PASSCODE) {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  if (checking) return null;
  if (unlocked) return <>{children}</>;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (entry === PASSCODE) {
      localStorage.setItem(STORAGE_KEY, PASSCODE);
      setUnlocked(true);
    } else {
      setError(true);
      setEntry("");
    }
  };

  return (
    <div className="flex items-center justify-center w-full min-h-screen bg-background">
      <div className="w-full max-w-[430px] min-h-screen bg-background flex flex-col shadow-2xl ring-1 ring-border/50">
        {/* Navy header */}
        <div className="bg-primary text-primary-foreground pt-16 pb-12 flex flex-col items-center">
          <Anchor className="w-14 h-14 mb-5 opacity-90" />
          <h1 className="font-serif text-3xl tracking-tight">Kinney Lake House</h1>
          <p className="text-primary-foreground/70 text-sm font-sans mt-1">Margie's Barge Report</p>
        </div>

        {/* Passcode form */}
        <div className="flex-1 flex flex-col items-center justify-start px-8 pt-12">
          <p className="font-sans text-sm text-muted-foreground text-center mb-6">
            Enter the family passcode to access the app.
          </p>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              value={entry}
              onChange={e => { setEntry(e.target.value); setError(false); }}
              placeholder="Passcode"
              className="h-12 text-center text-xl tracking-widest font-mono"
              autoFocus
              maxLength={8}
            />
            {error && (
              <p className="text-center text-sm text-destructive font-sans">
                Incorrect passcode. Please try again.
              </p>
            )}
            <Button type="submit" className="w-full h-12 font-serif text-base">
              Enter
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
