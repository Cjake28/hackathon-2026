import { Stack } from 'expo-router';

// No login — the hub is shared by the whole household. The tab navigator
// lives in (tabs)/_layout.tsx; this Stack adds the pushes (talk, task/[id],
// member/[id], device/[id], network) and the fullscreen modals (roadmap,
// personal-info, settings) on top of it, matching Nova's navigation model.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="talk" />
      <Stack.Screen name="task/[id]" />
      <Stack.Screen name="member/[id]" />
      <Stack.Screen name="device/[id]" />
      <Stack.Screen name="network" />
      <Stack.Screen name="roadmap" options={{ presentation: 'modal' }} />
      <Stack.Screen name="personal-info" options={{ presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
