import { useListBringItems, useCreateBringItem, useDeleteBringItem, getListBringItemsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShoppingBag, Check, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function BringTab() {
  const { data: items, isLoading } = useListBringItems();
  const queryClient = useQueryClient();
  const createItem = useCreateBringItem();
  const deleteItem = useDeleteBringItem();
  
  const [isOpen, setIsOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [personName, setPersonName] = useState("");

  const [resolveOpen, setResolveOpen] = useState<{isOpen: boolean, item: any}>({isOpen: false, item: null});
  const [resolvePerson, setResolvePerson] = useState("");

  if (isLoading) return <div className="p-4 flex justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !personName) return;
    
    await createItem.mutateAsync({
      data: { description, personName }
    });
    
    queryClient.invalidateQueries({ queryKey: getListBringItemsQueryKey() });
    setIsOpen(false);
    setDescription("");
    setPersonName("");
  };

  const handleMarkBrought = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolveOpen.item || !resolvePerson) return;
    
    await deleteItem.mutateAsync({
      id: resolveOpen.item.id,
      data: { personName: resolvePerson, broughtDate: format(new Date(), "yyyy-MM-dd") }
    });
    
    queryClient.invalidateQueries({ queryKey: getListBringItemsQueryKey() });
    setResolveOpen({isOpen: false, item: null});
    setResolvePerson("");
  };

  return (
    <div className="pb-8">
      <div className="bg-primary text-primary-foreground rounded-xl p-5 mb-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-4 -translate-y-4">
          <ShoppingBag className="w-32 h-32" />
        </div>
        <h2 className="font-serif text-xl mb-1 relative z-10">House Supplies</h2>
        <p className="text-sm opacity-90 relative z-10 font-sans max-w-[85%]">
          Running low on something? Add it here so the next person visiting knows what to bring.
        </p>
      </div>

      <div className="flex justify-between items-center mb-4 px-1">
        <h2 className="text-sm font-bold font-sans uppercase tracking-wider text-muted-foreground">Needed Items</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-8 gap-1"><Plus className="w-4 h-4"/> Request Item</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="font-serif text-xl">Request a Supply</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="itemDesc">What's needed?</Label>
                <Input id="itemDesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Paper towels, AA batteries" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reqPerson">Who is requesting?</Label>
                <Input id="reqPerson" value={personName} onChange={(e) => setPersonName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={createItem.isPending}>
                Add to List
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {items?.length === 0 ? (
        <div className="text-center py-10 bg-muted/20 rounded-lg border border-dashed border-border">
          <Check className="w-10 h-10 mx-auto text-emerald-300 mb-2" />
          <p className="text-sm text-muted-foreground font-medium">House is fully stocked!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items?.map(item => (
            <Card key={item.id} className="shadow-sm">
              <CardContent className="p-3 pl-4 flex justify-between items-center">
                <div>
                  <p className="font-medium text-base leading-tight mb-1">{item.description}</p>
                  <p className="text-xs text-muted-foreground">Requested by {item.personName} • {format(new Date(item.createdAt), "MMM d")}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="shrink-0 ml-4 rounded-full h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                  onClick={() => setResolveOpen({isOpen: true, item})}
                >
                  I'll bring it
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={resolveOpen.isOpen} onOpenChange={(open) => !open && setResolveOpen({isOpen: false, item: null})}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Mark as Brought</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMarkBrought} className="space-y-4 mt-2">
            <div className="p-3 bg-muted rounded-md mb-4 text-sm">
              You are bringing: <span className="font-bold">{resolveOpen.item?.description}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bringPerson">Who is bringing it?</Label>
              <Input id="bringPerson" value={resolvePerson} onChange={(e) => setResolvePerson(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={deleteItem.isPending}>
              Confirm & Remove from List
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
