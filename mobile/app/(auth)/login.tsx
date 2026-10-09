import { useState } from 'react';
import { Link } from 'expo-router';
import { AuthScreen, Field } from '@/components/AuthScreen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLogin } from '@/hooks/useAuth';

export default function LoginScreen() {
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => login.mutate({ email, password });

  return (
    <AuthScreen
      title="Log in"
      footer={
        <>
          <Text className="text-sm text-muted-foreground">No account yet?</Text>
          <Link href="/register" asChild>
            <Text className="text-sm font-medium underline">Sign up</Text>
          </Link>
        </>
      }
    >
      <Field>
        <Label>Email</Label>
        <Input
          testID="login-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
        />
      </Field>
      <Field>
        <Label>Password</Label>
        <Input
          testID="login-password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={submit}
        />
      </Field>
      <Button testID="login-submit" onPress={submit} disabled={login.isPending}>
        <Text>Log in</Text>
      </Button>
    </AuthScreen>
  );
}
