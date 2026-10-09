import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCan } from '@/hooks/useAuth';
import {
  useCreateItem,
  useDeleteItem,
  useItems,
  useSuggestItems,
  useUpdateItem,
} from '@/hooks/useItems';

export const Route = createFileRoute('/_app/items')({ component: ItemsPage });

function ItemsPage() {
  const { data: items, isLoading } = useItems();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const can = useCan();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Items</h1>
        <div className="flex gap-2">
          {can('items.create') && can('ai.use') && <GenerateItemsDialog />}
          {can('items.create') && <NewItemDialog />}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items?.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Checkbox
                    checked={item.done}
                    disabled={!can('items.update')}
                    onCheckedChange={(checked) =>
                      updateItem.mutate({ id: item.id, done: checked === true })
                    }
                  />
                </TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell>
                  <Badge variant={item.done ? 'secondary' : 'outline'}>
                    {item.done ? 'Done' : 'Open'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {can('items.delete') && (
                    <Button variant="ghost" size="icon" onClick={() => deleteItem.mutate(item.id)}>
                      <Trash2 />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No items yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </Card>
      )}
    </div>
  );
}

function NewItemDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const createItem = useCreateItem();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New item
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createItem.mutate(
              { name },
              {
                onSuccess: () => {
                  toast.success('Item created');
                  setName('');
                  setOpen(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New item</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createItem.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// AI example: describe a goal, the AI writes the items.
function GenerateItemsDialog() {
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const suggest = useSuggestItems();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles /> Generate with AI
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            suggest.mutate(goal, {
              onSuccess: (items) => {
                toast.success(`${items.length} items added`);
                setGoal('');
                setOpen(false);
              },
            });
          }}
        >
          <DialogHeader>
            <DialogTitle>Generate items with AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="goal">What do you want to get done?</Label>
            <Input
              id="goal"
              placeholder="e.g. Prepare our hackathon pitch"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={suggest.isPending}>
              {suggest.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
