import { DefaultTheme, type Theme } from 'expo-router/react-navigation';

/**
 * Design context ported from sj-esumbong — single light theme, no dark mode.
 * Kept as light/dark pair only because expo-router's ThemeProvider expects
 * both; dark mirrors light.
 */
const THEME_COLORS = {
  background: 'hsl(0 0% 100%)',
  foreground: 'hsl(136 15% 14%)',
  card: 'hsl(0 0% 100%)',
  cardForeground: 'hsl(136 15% 14%)',
  popover: 'hsl(0 0% 100%)',
  popoverForeground: 'hsl(136 15% 14%)',
  primary: 'hsl(145 65% 42%)',
  primaryForeground: 'hsl(0 0% 100%)',
  secondary: 'hsl(0 0% 94%)',
  secondaryForeground: 'hsl(136 15% 14%)',
  muted: 'hsl(0 0% 94%)',
  mutedForeground: 'hsl(0 0% 31%)',
  accent: 'hsl(0 0% 94%)',
  accentForeground: 'hsl(136 15% 14%)',
  destructive: 'hsl(12 67% 55%)',
  border: 'hsl(0 0% 88%)',
  input: 'hsl(0 0% 88%)',
  ring: 'hsl(145 65% 42%)',
  radius: '1rem',
  chart1: 'hsl(145 65% 42%)',
  chart2: 'hsl(173 55% 45%)',
  chart3: 'hsl(37 55% 45%)',
  chart4: 'hsl(248 55% 45%)',
  chart5: 'hsl(340 55% 45%)',
} as const;

export const THEME = { light: THEME_COLORS, dark: THEME_COLORS };

export const NAV_THEME: Record<'light' | 'dark', Theme> = {
  light: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
  dark: {
    ...DefaultTheme,
    colors: {
      background: THEME.light.background,
      border: THEME.light.border,
      card: THEME.light.card,
      notification: THEME.light.destructive,
      primary: THEME.light.primary,
      text: THEME.light.foreground,
    },
  },
};
