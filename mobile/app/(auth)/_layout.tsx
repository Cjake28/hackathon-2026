import { Stack } from 'expo-router';

// The one screen you can reach logged out. There's no sign-up: Mom or Dad makes every
// account (app/(app)/accounts.tsx), so the hub knows whose phone this is.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
