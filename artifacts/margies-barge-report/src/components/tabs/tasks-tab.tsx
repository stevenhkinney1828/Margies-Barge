import { useListTasks, useCompleteTask, getListTasksQueryKey, Task } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, AlertCircle, Clock, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function TasksTab() {
  const { data: tasks, isLoading } = useListTasks();
  const queryClient = useQueryClient();
  const completeTask = useCompleteTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [personName, setPersonName] = useState("");
  const [workDate, setWorkDate] = useState(format(new Date(), "yyyy-MM-dd"));

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !personName) return;
    
    await completeTask.mutateAsync({
      id: selectedTask.id,
      data: { personName, workDate }
    });
    
    queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
    setSelectedTask(null);
    setPersonName("");
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "overdue": return <Badge variant="destructive" className="flex gap-1"><AlertCircle className="w-3 h-3"/> Overdue</Badge>;
      case "due-soon": return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200 flex gap-1"><Clock className="w-3 h-3"/> Due Soon</Badge>;
      case "seasonal": return <Badge variant="outline" className="bg-slate-100 text-slate-600 flex gap-1"><Snowflake className="w-3 h-3"/> Seasonal</Badge>;
      default: return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex gap-1"><CheckCircle2 className="w-3 h-3"/> Good</Badge>;
    }
  };

  // Group tasks
  const overdue = tasks?.filter(t => t.status === "overdue") || [];
  const dueSoon = tasks?.filter(t => t.status === "due-soon") || [];
  const good = tasks?.filter(t => t.status === "good") || [];
  const seasonal = tasks?.filter(t => t.status === "seasonal") || [];

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className="mb-3 shadow-sm border-border overflow-hidden">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className="w-16 bg-muted/30 flex items-center justify-center text-2xl border-r border-border/50 shrink-0">
            {task.icon}
          </div>
          <div className="p-3 flex-1 min-w-0">
            <div className="flex justify-between items-start mb-1">
              <h3 className="font-serif font-medium text-base truncate pr-2">{task.name}</h3>
              <div className="shrink-0">{getStatusBadge(task.status)}</div>
            </div>
            
            <div className="text-xs text-muted-foreground font-sans space-y-1 mt-2">
              <p>Every {task.cadenceLabel}</p>
              {task.lastDoneDate ? (
                <p>Last: {format(new Date(task.lastDoneDate), "MMM d")} by {task.lastDoneBy}</p>
              ) : (
                <p>Never completed</p>
              )}
            </div>
            
            {task.notes && (
              <p className="text-xs mt-2 bg-muted/50 p-2 rounded text-muted-foreground border border-border/50 italic">
                "{task.notes}"
              </p>
            )}
            
            <div className="mt-3 flex justify-end">
              <Button 
                variant={task.status === "overdue" || task.status === "due-soon" ? "default" : "outline"}
                size="sm" 
                className="h-8 font-sans font-medium text-xs px-3"
                onClick={() => setSelectedTask(task)}
              >
                Mark Done
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const Section = ({ title, tasks }: { title: string, tasks: Task[] }) => {
    if (tasks.length === 0) return null;
    return (
      <div className="mb-6">
        <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground mb-3 px-1">{title}</h2>
        <div>{tasks.map(t => <TaskCard key={t.id} task={t} />)}</div>
      </div>
    );
  };

  return (
    <div className="pb-8">
      <Section title="Needs Attention" tasks={[...overdue, ...dueSoon]} />
      <Section title="Up to Date" tasks={good} />
      <Section title="Out of Season" tasks={seasonal} />
      
      {tasks?.length === 0 && (
        <div className="text-center p-8 text-muted-foreground">
          <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-200 mb-3" />
          <p className="font-serif text-lg">All caught up!</p>
          <p className="text-sm font-sans mt-1">No tasks configured.</p>
        </div>
      )}

      <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl flex items-center gap-2">
              <span>{selectedTask?.icon}</span>
              <span>Complete {selectedTask?.name}</span>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleComplete} className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label htmlFor="personName">Who did it?</Label>
              <Input 
                id="personName" 
                value={personName} 
                onChange={(e) => setPersonName(e.target.value)} 
                placeholder="e.g. Aunt Sarah" 
                required 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workDate">When?</Label>
              <Input 
                id="workDate" 
                type="date" 
                value={workDate} 
                onChange={(e) => setWorkDate(e.target.value)} 
                required 
              />
            </div>
            <Button type="submit" className="w-full" disabled={completeTask.isPending}>
              {completeTask.isPending ? "Saving..." : "Mark as Done"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
