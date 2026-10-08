import { Redirect, Stack } from 'expo-router';
import { useMe } from '@/hooks/useAuth';

// Public screens. Already logged in → go to the app.
export default function AuthLayout() {
  const { data: user, isLoading } = useMe();

  if (isLoading) return null;
  if (user) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
