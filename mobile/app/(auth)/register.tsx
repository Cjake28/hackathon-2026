import { useState } from 'react';
import { Link, router } from 'expo-router';
import { AuthScreen, Field } from '@/components/AuthScreen';
import { GoogleButton } from '@/components/GoogleButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useRegister } from '@/hooks/useAuth';

export default function RegisterScreen() {
  const register = useRegister();
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const submit = () =>
    register.mutate(form, {
      onSuccess: ({ email }) => router.push({ pathname: '/verify', params: { email } }),
    });

  return (
    <AuthScreen
      title="Create an account"
      description="We'll email you a 6-digit code to verify it."
      footer={
        <>
          <Text className="text-sm text-muted-foreground">Already have an account?</Text>
          <Link href="/login" asChild>
            <Text className="text-sm font-medium underline">Log in</Text>
          </Link>
        </>
      }
    >
      <GoogleButton />
      <Field>
        <Label>Name</Label>
        <Input value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
      </Field>
      <Field>
        <Label>Email</Label>
        <Input
          value={form.email}
          onChangeText={(email) => setForm({ ...form, email })}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
      </Field>
      <Field>
        <Label>Password (8+ characters)</Label>
        <Input
          value={form.password}
          onChangeText={(password) => setForm({ ...form, password })}
          secureTextEntry
          onSubmitEditing={submit}
        />
      </Field>
      <Button onPress={submit} disabled={register.isPending}>
        <Text>Sign up</Text>
      </Button>
    </AuthScreen>
  );
}
