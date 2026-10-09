import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { JoinQr } from '@/components/JoinQr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMe } from '@/hooks/useAuth';

export const Route = createFileRoute('/_app/')({ component: HomePage });

function HomePage() {
  const { data: user } = useMe();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Welcome back, <span className="text-primary">{user?.name}</span>
        </h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.role}</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="transition-shadow hover:shadow-lifted">
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>What your role can see and do</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {user?.permissions.map((p) => (
                <Badge key={p} variant="secondary" className="rounded-md">
                  {p === '*' ? 'All permissions' : p}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-lifted">
          <CardHeader>
            <CardTitle>Example feature</CardTitle>
            <CardDescription>A simple to-do list wired end to end</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/items">
                Open Items <ArrowUpRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <JoinQr />
    </div>
  );
}
