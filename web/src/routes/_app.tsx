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
  { to: '/map', label: 'Map', permission: 'location.share' },
  { to: '/ai', label: 'AI Chat', permission: 'ai.use' },
  { to: '/docs', label: 'Docs', permission: 'ai.use' },
  { to: '/users', label: 'Users', permission: 'users.manage' },
  { to: '/roles', label: 'Roles', permission: 'roles.manage' },
  { to: '/ai-settings', label: 'AI Settings', permission: 'ai.manage' },
] as const;

function AppLayout() {
  const { data: user, isLoading } = useMe();
  const can = useCan();
  const logout = useLogout();

  if (isLoading) return null;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 px-4 pt-4">
        <nav className="glass mx-auto flex h-14 max-w-5xl items-center gap-1 rounded-2xl px-3 shadow-soft ring-1 ring-foreground/10">
          <span className="mr-3 flex items-center gap-2 pl-1 font-heading font-semibold tracking-tight">
            <span className="size-2 rounded-full bg-primary shadow-[0_0_12px_2px_var(--primary)]" />
            Hackathon
          </span>
          {nav
            .filter((n) => !('permission' in n) || can(n.permission))
            .map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === '/' }}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&.active]:bg-accent [&.active]:font-medium [&.active]:text-accent-foreground"
              >
                {n.label}
              </Link>
            ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="ml-auto rounded-lg">
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
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
