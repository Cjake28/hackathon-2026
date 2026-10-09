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
import { queryClient } from '@/lib/query';
import { NAV_THEME } from '@/lib/theme';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Every screen under app/(app)/ needs a login: the hub has to know whose phone this is
// (see app/(app)/_layout.tsx). Family, tasks and alarms all live on the hub, not here.
export default function RootLayout() {
  const { colorScheme } = useColorScheme();

  const [fontsLoaded] = useFonts({
    'Fredoka-Regular': require('@/assets/fonts/Fredoka-Regular.ttf'),
    'Fredoka-Medium': require('@/assets/fonts/Fredoka-Medium.ttf'),
    'Fredoka-SemiBold': require('@/assets/fonts/Fredoka-SemiBold.ttf'),
    'Fredoka-Bold': require('@/assets/fonts/Fredoka-Bold.ttf'),
  });

  // Hold the splash until the fonts load, so the app never flashes system fonts.
  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

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
