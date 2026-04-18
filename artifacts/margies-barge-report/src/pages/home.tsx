import { useState } from "react";
import { DockTab } from "@/components/tabs/dock-tab";
import { TasksTab } from "@/components/tabs/tasks-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import { BringTab } from "@/components/tabs/bring-tab";
import { IssuesTab } from "@/components/tabs/issues-tab";
import { LogTab } from "@/components/tabs/log-tab";
import { SettingsDialog } from "@/components/settings-dialog";
import { Anchor, CheckSquare, Calendar, ShoppingBag, AlertTriangle, ScrollText } from "lucide-react";

const TABS = [
  { id: "dock",     label: "Dock",     icon: Anchor },
  { id: "tasks",    label: "Tasks",    icon: CheckSquare },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "bring",    label: "Bring",    icon: ShoppingBag },
  { id: "issues",   label: "Issues",   icon: AlertTriangle },
  { id: "log",      label: "Log",      icon: ScrollText },
] as const;

type TabId = typeof TABS[number]["id"];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>("dock");

  return (
    <div className="flex justify-center w-full min-h-screen bg-background">
      <div className="w-full max-w-[430px] min-h-screen bg-background flex flex-col relative shadow-2xl overflow-hidden ring-1 ring-border/50">

        {/* Navy Header with inline tab strip */}
        <header className="bg-primary text-primary-foreground pt-10 shadow-md z-10 shrink-0">
          <div className="flex justify-between items-start px-5 pb-3">
            <div>
              <h1 className="font-serif text-2xl tracking-tight">Kinney Lake House</h1>
              <p className="text-primary-foreground/70 text-sm font-sans mt-0.5">Margie's Barge Report</p>
            </div>
            <SettingsDialog />
          </div>

          {/* Tab strip inside header */}
          <div className="flex overflow-x-auto scrollbar-hide border-t border-primary-foreground/20">
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-[56px] py-2.5 text-[10px] font-sans font-medium tracking-wide transition-colors relative shrink-0 ${
                    active
                      ? "text-primary-foreground"
                      : "text-primary-foreground/55 hover:text-primary-foreground/80"
                  }`}
                >
                  <Icon className="w-4 h-4" strokeWidth={active ? 2.5 : 2} />
                  <span>{label}</span>
                  {active && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-foreground rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto pb-8 px-4 pt-5">
          {activeTab === "dock"     && <DockTab />}
          {activeTab === "tasks"    && <TasksTab />}
          {activeTab === "calendar" && <CalendarTab />}
          {activeTab === "bring"    && <BringTab />}
          {activeTab === "issues"   && <IssuesTab />}
          {activeTab === "log"      && <LogTab />}
        </main>
      </div>
    </div>
  );
}
