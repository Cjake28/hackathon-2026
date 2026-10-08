import { useState } from 'react';
import { Link, Navigate, createFileRoute, useNavigate } from '@tanstack/react-router';
import { AuthCard } from '@/components/AuthCard';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMe, useRegister } from '@/hooks/useAuth';

export const Route = createFileRoute('/register')({ component: RegisterPage });

function RegisterPage() {
  const { data: user } = useMe();
  const register = useRegister();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  if (user) return <Navigate to="/" />;

  return (
    <AuthCard
      title="Create an account"
      description="We'll email you a 6-digit code to verify it."
      footer={
        <>
          Already have an account?
          <Link to="/login" className="underline">
            Log in
          </Link>
        </>
      }
    >
      <GoogleButton />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate(form, {
            onSuccess: ({ email }) => navigate({ to: '/verify', search: { email } }),
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
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
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={register.isPending}>
          Sign up
        </Button>
      </form>
    </AuthCard>
  );
}
