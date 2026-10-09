import { Link, createFileRoute } from '@tanstack/react-router';
import { JoinQr } from '@/components/JoinQr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMe } from '@/hooks/useAuth';

export const Route = createFileRoute('/_app/')({ component: HomePage });

function HomePage() {
  const { data: user } = useMe();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Welcome, {user?.name}</h1>
      <p className="text-muted-foreground">
        Role: <span className="font-medium text-foreground">{user?.role}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {user?.permissions.map((p) => (
          <Badge key={p} variant="secondary">
            {p === '*' ? 'All permissions' : p}
          </Badge>
        ))}
      </div>
      <Button asChild>
        <Link to="/items">Open the example</Link>
      </Button>
      <JoinQr />
    </div>
  );
}
