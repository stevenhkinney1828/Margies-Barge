import { useListActivity } from "@workspace/api-client-react";
import { format } from "date-fns";
import { Activity, Anchor, CheckSquare, Wrench, PlusCircle, AlertTriangle, Calendar, ShoppingBag } from "lucide-react";

export function LogTab() {
  const { data: activities, isLoading } = useListActivity();

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const getActivityIcon = (action: string) => {
    if (action.includes("Dock moved")) return <Anchor className="w-4 h-4 text-blue-600" />;
    if (action.includes("Task completed")) return <CheckSquare className="w-4 h-4 text-emerald-600" />;
    if (action.includes("Issue reported") || action.includes("urgent")) return <AlertTriangle className="w-4 h-4 text-destructive" />;
    if (action.includes("Issue resolved")) return <Wrench className="w-4 h-4 text-emerald-600" />;
    if (action.includes("Task created")) return <PlusCircle className="w-4 h-4 text-primary" />;
    if (action.includes("Booking")) return <Calendar className="w-4 h-4 text-purple-600" />;
    if (action.includes("Bring item")) return <ShoppingBag className="w-4 h-4 text-amber-600" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="pb-8">
      <div className="flex items-center gap-2 mb-6 px-1 text-muted-foreground">
        <Activity className="w-5 h-5" />
        <h2 className="text-sm font-bold font-sans uppercase tracking-wider">House Log</h2>
      </div>

      <div className="relative pl-3">
        {/* Vertical line connecting timeline items */}
        <div className="absolute top-2 bottom-0 left-[21px] w-px bg-border"></div>
        
        <div className="space-y-6">
          {activities?.map((activity, i) => (
            <div key={activity.id} className="relative flex gap-4 items-start">
              <div className="absolute left-0 mt-1 w-5 h-5 rounded-full bg-background border-2 border-primary flex items-center justify-center shrink-0 shadow-sm z-10 overflow-hidden">
                <div className="w-3 h-3 flex items-center justify-center bg-muted/50 rounded-full">
                  {getActivityIcon(activity.action)}
                </div>
              </div>
              <div className="pl-8 flex-1">
                <p className="text-sm text-foreground">
                  <span className="font-bold">{activity.personName}</span>{" "}
                  {activity.action}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(activity.actionDate || activity.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          ))}
          
          {activities?.length === 0 && (
            <div className="text-center py-10 text-muted-foreground pl-4">
              <p>No activity recorded yet.</p>
            </div>
          )}
          
          {activities && activities.length > 0 && (
            <div className="relative flex gap-4 items-start">
              <div className="absolute left-0 w-5 h-5 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 z-10">
                <div className="w-1.5 h-1.5 bg-border rounded-full"></div>
              </div>
              <div className="pl-8 pt-0.5">
                <p className="text-xs text-muted-foreground italic">End of history</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
