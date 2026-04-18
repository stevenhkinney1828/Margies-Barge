import { useState } from "react";
import { DockTab } from "@/components/tabs/dock-tab";
import { TasksTab } from "@/components/tabs/tasks-tab";
import { CalendarTab } from "@/components/tabs/calendar-tab";
import { BringTab } from "@/components/tabs/bring-tab";
import { IssuesTab } from "@/components/tabs/issues-tab";
import { LogTab } from "@/components/tabs/log-tab";
import { SettingsDialog } from "@/components/settings-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Anchor, CheckSquare, Calendar, ShoppingBag, AlertTriangle, ScrollText } from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("dock");

  return (
    <div className="flex justify-center w-full min-h-screen bg-background">
      <div className="w-full max-w-[430px] min-h-screen bg-background flex flex-col relative shadow-2xl overflow-hidden ring-1 ring-border/50">
        
        {/* Navy Header */}
        <header className="bg-primary text-primary-foreground pt-12 pb-4 px-6 shadow-sm z-10 shrink-0 flex justify-between items-start">
          <div>
            <h1 className="font-serif text-2xl tracking-tight">Kinney Lake House</h1>
            <p className="text-primary-foreground/70 text-sm font-sans mt-0.5">Margie's Barge Report</p>
          </div>
          <SettingsDialog />
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto pb-24 px-4 pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full">
            <TabsContent value="dock" className="m-0 h-full data-[state=inactive]:hidden"><DockTab /></TabsContent>
            <TabsContent value="tasks" className="m-0 h-full data-[state=inactive]:hidden"><TasksTab /></TabsContent>
            <TabsContent value="calendar" className="m-0 h-full data-[state=inactive]:hidden"><CalendarTab /></TabsContent>
            <TabsContent value="bring" className="m-0 h-full data-[state=inactive]:hidden"><BringTab /></TabsContent>
            <TabsContent value="issues" className="m-0 h-full data-[state=inactive]:hidden"><IssuesTab /></TabsContent>
            <TabsContent value="log" className="m-0 h-full data-[state=inactive]:hidden"><LogTab /></TabsContent>
          </Tabs>
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 bg-card border-t border-border/40 pb-safe z-20 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
          <div className="flex items-center justify-between px-2 pt-2 pb-1 h-[68px]">
            <NavItem active={activeTab === "dock"} onClick={() => setActiveTab("dock")} icon={<Anchor className="w-5 h-5" />} label="Dock" />
            <NavItem active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")} icon={<CheckSquare className="w-5 h-5" />} label="Tasks" />
            <NavItem active={activeTab === "calendar"} onClick={() => setActiveTab("calendar")} icon={<Calendar className="w-5 h-5" />} label="Calendar" />
            <NavItem active={activeTab === "bring"} onClick={() => setActiveTab("bring")} icon={<ShoppingBag className="w-5 h-5" />} label="Bring" />
            <NavItem active={activeTab === "issues"} onClick={() => setActiveTab("issues")} icon={<AlertTriangle className="w-5 h-5" />} label="Issues" />
            <NavItem active={activeTab === "log"} onClick={() => setActiveTab("log")} icon={<ScrollText className="w-5 h-5" />} label="Log" />
          </div>
        </nav>
      </div>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-[64px] h-[54px] rounded-lg transition-colors active-elevate no-default-active-elevate ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      }`}
    >
      <div className={`mb-1 transition-transform ${active ? "scale-110" : ""}`}>
        {icon}
      </div>
      <span className={`text-[10px] leading-none font-medium ${active ? "font-bold" : ""}`}>
        {label}
      </span>
    </button>
  );
}
