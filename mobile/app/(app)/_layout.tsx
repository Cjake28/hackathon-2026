import { Redirect, Stack } from 'expo-router';
import { HubListener } from '@/components/HubListener';
import { useMe } from '@/hooks/useAuth';

// Logged in only: the hub needs to know whose phone this is (app/(auth)/login.tsx). The tab navigator lives in
// (tabs)/_layout.tsx; this Stack adds the pushes and modals on top. HubListener polls the hub and shows ringing alarms.
export default function AppLayout() {
  const { data: me, isPending } = useMe();
  if (isPending) return null;
  if (!me) return <Redirect href="/login" />;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="talk" />
        <Stack.Screen name="task/[id]" />
        <Stack.Screen name="member/[id]" />
        <Stack.Screen name="device/[id]" />
        <Stack.Screen name="network" />
        <Stack.Screen name="grocery" />
        <Stack.Screen name="memory" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="budget" />
        <Stack.Screen name="heard" />
        <Stack.Screen name="accounts" />
        <Stack.Screen name="roles" />
        <Stack.Screen name="roadmap" options={{ presentation: 'modal' }} />
        <Stack.Screen name="personal-info" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
      <HubListener />
    </>
  );
}
