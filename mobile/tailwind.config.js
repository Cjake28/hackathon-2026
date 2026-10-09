const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          glow: 'hsl(var(--primary-glow))',
          soft: 'hsl(var(--primary-soft))',
          softForeground: 'hsl(var(--primary-soft-foreground))',
          edge: 'hsl(var(--primary-edge))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          edge: 'hsl(var(--secondary-edge))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
          edge: 'hsl(var(--destructive-edge))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        verified: 'hsl(var(--verified))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          arc: { base: 'hsl(var(--accent-arc-base))', soft: 'hsl(var(--accent-arc-soft))', onSoft: 'hsl(var(--accent-arc-on-soft))' },
          azure: { base: 'hsl(var(--accent-azure-base))', soft: 'hsl(var(--accent-azure-soft))', onSoft: 'hsl(var(--accent-azure-on-soft))' },
          teal: { base: 'hsl(var(--accent-teal-base))', soft: 'hsl(var(--accent-teal-soft))', onSoft: 'hsl(var(--accent-teal-on-soft))' },
          amber: { base: 'hsl(var(--accent-amber-base))', soft: 'hsl(var(--accent-amber-soft))', onSoft: 'hsl(var(--accent-amber-on-soft))' },
          violet: { base: 'hsl(var(--accent-violet-base))', soft: 'hsl(var(--accent-violet-soft))', onSoft: 'hsl(var(--accent-violet-on-soft))' },
          rose: { base: 'hsl(var(--accent-rose-base))', soft: 'hsl(var(--accent-rose-soft))', onSoft: 'hsl(var(--accent-rose-on-soft))' },
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sunken: {
          DEFAULT: 'hsl(var(--sunken))',
          foreground: 'hsl(var(--sunken-foreground))',
          edge: 'hsl(var(--sunken-edge))',
        },
      },
      // Lexend, loaded via useFonts in app/_layout.tsx. Four static weights
      // (no variable font), so each weight is its own family rather than a
      // fontWeight on one family — see components/ui/text.tsx.
      fontFamily: {
        sans: ['Lexend-Regular'],
        'sans-medium': ['Lexend-Medium'],
        'sans-semibold': ['Lexend-SemiBold'],
        'sans-bold': ['Lexend-Bold'],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 10px)',
        sm: 'calc(var(--radius) - 14px)',
        xl: 'calc(var(--radius) + 6px)',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [require('tailwindcss-animate')],
};
