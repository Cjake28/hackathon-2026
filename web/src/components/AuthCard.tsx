import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// Centered card used by the login, register and verify pages.
export function AuthCard(props: {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm shadow-lifted">
        <CardHeader>
          <div className="mb-1 size-9 rounded-xl bg-primary shadow-[0_0_20px_2px_var(--primary)]" />
          <CardTitle className="font-heading text-xl">{props.title}</CardTitle>
          {props.description && <CardDescription>{props.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">{props.children}</CardContent>
        {props.footer && (
          <CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
            {props.footer}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
