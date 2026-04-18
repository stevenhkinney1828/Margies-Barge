import { useListBookings, useCreateBooking, useDeleteBooking, getListBookingsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { Calendar as CalendarIcon, Trash2, Plus, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CalendarTab() {
  const { data: bookings, isLoading } = useListBookings();
  const queryClient = useQueryClient();
  const createBooking = useCreateBooking();
  const deleteBooking = useDeleteBooking();
  
  const [isOpen, setIsOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [spokeWithUncles, setSpokeWithUncles] = useState(false);
  const [spokeWithCousins, setSpokeWithCousins] = useState(false);

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName || !startDate || !endDate) return;
    
    await createBooking.mutateAsync({
      data: { personName, startDate, endDate, spokeWithUncles, spokeWithCousins }
    });
    
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
    setIsOpen(false);
    setPersonName("");
    setStartDate("");
    setEndDate("");
    setSpokeWithUncles(false);
    setSpokeWithCousins(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this visit?")) return;
    await deleteBooking.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() });
  };

  const today = new Date();
  const upcomingBookings = bookings?.filter(b => !isBefore(new Date(b.endDate), today)).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()) || [];
  const pastBookings = bookings?.filter(b => isBefore(new Date(b.endDate), today)).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()) || [];

  const BookingCard = ({ booking }: { booking: any }) => (
    <Card className="mb-3 shadow-sm border-l-4 border-l-primary">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-serif font-bold text-lg text-primary">{booking.personName}</h3>
            <div className="flex items-center text-sm text-muted-foreground mt-1 gap-1.5 font-sans">
              <CalendarIcon className="w-4 h-4" />
              <span>
                {format(new Date(booking.startDate), "MMM d")} - {format(new Date(booking.endDate), "MMM d, yyyy")}
              </span>
            </div>
            {!booking.googleEventId && (
              <p className="text-[10px] text-amber-600 mt-2 bg-amber-50 inline-block px-2 py-0.5 rounded font-medium border border-amber-200">
                Pending Calendar Sync
              </p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive -mt-1 -mr-1" onClick={() => handleDelete(booking.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="pb-8">
      <Alert className="mb-6 bg-blue-50 border-blue-200 text-blue-800 [&>svg]:text-blue-600">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Google Calendar integration is pending. New visits will appear here but won't sync to the family calendar yet.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground">Upcoming Visits</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1"><Plus className="w-4 h-4"/> Add Visit</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Schedule a Visit</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="personName">Who is visiting?</Label>
                <Input id="personName" value={personName} onChange={(e) => setPersonName(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              
              <div className="bg-muted/50 p-4 rounded-md border border-border mt-4 space-y-4">
                <p className="text-sm font-medium mb-2">House Rules Checklist</p>
                <div className="flex items-start space-x-3">
                  <Checkbox id="uncles" checked={spokeWithUncles} onCheckedChange={(c) => setSpokeWithUncles(!!c)} />
                  <label htmlFor="uncles" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I have cleared this with the Uncles
                  </label>
                </div>
                <div className="flex items-start space-x-3">
                  <Checkbox id="cousins" checked={spokeWithCousins} onCheckedChange={(c) => setSpokeWithCousins(!!c)} />
                  <label htmlFor="cousins" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    I have notified the Cousins text thread
                  </label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createBooking.isPending || (!spokeWithUncles && !spokeWithCousins)}>
                {createBooking.isPending ? "Adding..." : "Add to Calendar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {upcomingBookings.length > 0 ? (
        upcomingBookings.map(b => <BookingCard key={b.id} booking={b} />)
      ) : (
        <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed border-border mb-6">
          <CalendarIcon className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">No upcoming visits planned.</p>
        </div>
      )}

      {pastBookings.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground mb-4 px-1">Past Visits</h2>
          <div className="opacity-70">
            {pastBookings.map(b => <BookingCard key={b.id} booking={b} />)}
          </div>
        </div>
      )}
    </div>
  );
}
