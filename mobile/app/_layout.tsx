import '@/global.css';

import { PortalHost } from '@rn-primitives/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'nativewind';
import { useEffect } from 'react';
import { useAlarmsStore } from '@/hooks/useAlarms';
import { useFamilyStore } from '@/hooks/useFamily';
import { useTasksStore } from '@/hooks/useTasks';
import { queryClient } from '@/lib/query';
import { NAV_THEME } from '@/lib/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Every screen under app/(app)/ is reachable with no login — the hub is
// shared by the whole household (see app/(app)/_layout.tsx).
export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  const [fontsLoaded] = useFonts({
    'Lexend-Regular': require('@/assets/fonts/Lexend-Regular.ttf'),
    'Lexend-Medium': require('@/assets/fonts/Lexend-Medium.ttf'),
    'Lexend-SemiBold': require('@/assets/fonts/Lexend-SemiBold.ttf'),
    'Lexend-Bold': require('@/assets/fonts/Lexend-Bold.ttf'),
  });

  // Hold the splash until fonts load and the Nova stores read back from
  // AsyncStorage, so the app never flashes system fonts or seeded data before
  // swapping to what was saved.
  const familyHydrated = useFamilyStore((state) => state.hasHydrated);
  const tasksHydrated = useTasksStore((state) => state.hasHydrated);
  const alarmsHydrated = useAlarmsStore((state) => state.hasHydrated);
  const ready = fontsLoaded && familyHydrated && tasksHydrated && alarmsHydrated;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
