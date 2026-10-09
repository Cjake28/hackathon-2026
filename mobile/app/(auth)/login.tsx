import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { useLogin, useMe } from '@/hooks/useAuth';

// There's no sign-up: Mom or Dad makes every account (app/(app)/accounts.tsx). The hub needs to know whose phone
// this is: Ana's phone rings for Ana's alarms, and a child can't delete the alarm Mom set.
// Plain screen, no card and no logo mark: heading, two fields, one chunky button.
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { data: me } = useMe();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me) return <Redirect href="/(app)/(tabs)" />;

  const submit = () => {
    if (!email.trim() || !password) return;
    login.mutate({ email: email.trim(), password });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
    >
      <ScrollView
        contentContainerClassName="flex-grow justify-center gap-8 px-6"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-2">
          <Text className="text-4xl font-sans-bold tracking-[-0.03em]">Welcome back</Text>
          <Text variant="muted" className="text-base">
            Mom or Dad makes your account. Ask them for your login.
          </Text>
        </View>

        <View className="gap-4">
          <View className="gap-2">
            <Label>Login</Label>
            <Input
              testID="login-email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="username"
              placeholder="ana, or ana@family.local"
              className="h-14 rounded-2xl px-4 text-base"
            />
          </View>
          <View className="gap-2">
            <Label>Password</Label>
            <Input
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              onSubmitEditing={submit}
              className="h-14 rounded-2xl px-4 text-base"
            />
          </View>
        </View>

        <View className="gap-3">
          <Button testID="login-submit" size="lg" disabled={login.isPending} onPress={submit}>
            <Text>{login.isPending ? 'Logging in…' : 'Log in'}</Text>
          </Button>
          <Text variant="muted" className="text-center">
            Everything you do stays on the hub at home.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
