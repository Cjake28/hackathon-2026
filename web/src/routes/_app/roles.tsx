import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
import { useCreateRole, useDeleteRole, useRoles, useUpdateRole } from '@/hooks/useRoles';
import { PERMISSIONS, type Permission, type Role } from '@/types';

export const Route = createFileRoute('/_app/roles')({ component: RolesPage });

function RolesPage() {
  const { data: roles, isLoading } = useRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles</h1>
        <NewRoleDialog />
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {roles?.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoleCard({ role }: { role: Role }) {
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();
  const isAdmin = role.permissions.includes('*');

  const toggle = (permission: Permission, on: boolean) =>
    updateRole.mutate({
      id: role.id,
      permissions: on
        ? [...role.permissions, permission]
        : role.permissions.filter((p) => p !== permission),
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{role.name}</CardTitle>
        <CardDescription>{role._count.users} user(s)</CardDescription>
        {!isAdmin && (
          <CardAction>
            <Button variant="ghost" size="icon" onClick={() => deleteRole.mutate(role.id)}>
              <Trash2 />
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {isAdmin ? (
          <Badge>All permissions</Badge>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {PERMISSIONS.map((permission) => (
              <Label key={permission} className="font-normal">
                <Checkbox
                  checked={role.permissions.includes(permission)}
                  onCheckedChange={(checked) => toggle(permission, checked === true)}
                />
                {permission}
              </Label>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NewRoleDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const createRole = useCreateRole();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New role
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            createRole.mutate(
              { name, permissions: [] },
              {
                onSuccess: () => {
                  toast.success('Role created');
                  setName('');
                  setOpen(false);
                },
              },
            );
          }}
        >
          <DialogHeader>
            <DialogTitle>New role</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createRole.isPending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
