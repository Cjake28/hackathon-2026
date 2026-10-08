import { Link, Navigate, Outlet, createFileRoute } from '@tanstack/react-router';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCan, useLogout, useMe } from '@/hooks/useAuth';

// Every page in routes/_app/ requires login and gets this layout.
export const Route = createFileRoute('/_app')({ component: AppLayout });

// Add a link here for every new page. `permission` hides the link from users without it.
const nav = [
  { to: '/', label: 'Home' },
  { to: '/items', label: 'Items', permission: 'items.read' },
  { to: '/ai', label: 'AI Chat', permission: 'ai.use' },
  { to: '/docs', label: 'Docs', permission: 'ai.use' },
  { to: '/users', label: 'Users', permission: 'users.manage' },
  { to: '/roles', label: 'Roles', permission: 'roles.manage' },
] as const;

function AppLayout() {
  const { data: user, isLoading } = useMe();
  const can = useCan();
  const logout = useLogout();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
          <span className="font-semibold">Hackathon</span>
          {nav
            .filter((n) => !('permission' in n) || can(n.permission))
            .map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === '/' }}
                className="text-sm text-muted-foreground hover:text-foreground [&.active]:font-medium [&.active]:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto">
                {user.name}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <div>{user.email}</div>
                <div className="text-xs font-normal text-muted-foreground">Role: {user.role}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout.mutate()}>
                <LogOut /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
