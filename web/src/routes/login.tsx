import { useState } from 'react';
import { Link, Navigate, createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useLogin, useMe } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

export const Route = createFileRoute('/login')({ component: LoginPage });

function LoginPage() {
  const { data: user } = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });

  if (user) return <Navigate to="/" />;

  return (
    <AuthCard
      title="Log in"
      footer={
        <>
          No account yet?
          <Link to="/register" className="underline">
            Sign up
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          login.mutate(form, {
            // 403 = signed up but never entered the email code.
            onError: (error) => {
              if (error instanceof ApiError && error.status === 403) {
                navigate({ to: '/verify', search: { email: form.email } });
              }
            },
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
