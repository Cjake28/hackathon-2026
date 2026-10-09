import { cn } from '@/lib/utils';
import { Slot } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Text as RNText, type Role } from 'react-native';

// Four static Lexend weights, each its own font-family (see
// tailwind.config.js) rather than a `font-weight` on one family — static TTFs
// don't synthesize weight reliably, especially on Android.
const textVariants = cva(
  cn(
    'text-foreground text-base font-sans tracking-[-0.02em]',
    Platform.select({
      web: 'select-text',
    })
  ),
  {
    variants: {
      variant: {
        default: '',
        h1: cn(
          'text-center text-5xl font-sans-bold tracking-[-0.03em]',
          Platform.select({ web: 'scroll-m-20 text-balance' })
        ),
        h2: cn(
          'pb-2 text-4xl font-sans-bold tracking-[-0.03em]',
          Platform.select({ web: 'scroll-m-20 first:mt-0' })
        ),
        h3: cn('text-3xl font-sans-bold tracking-[-0.02em]', Platform.select({ web: 'scroll-m-20' })),
        h4: cn('text-xl font-sans-bold tracking-[-0.02em]', Platform.select({ web: 'scroll-m-20' })),
        p: 'mt-3 text-foreground/50 leading-7 sm:mt-6',
        blockquote: 'mt-4 pl-3 italic sm:mt-6 sm:pl-6',
        code: 'bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-sans-semibold',
        lead: 'text-muted-foreground text-xl',
        large: 'text-lg font-sans-semibold',
        small: 'text-sm font-sans-medium leading-none',
        muted: 'text-muted-foreground text-sm',
        label: 'text-lg font-sans-bold tracking-[-0.01em]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type TextVariantProps = VariantProps<typeof textVariants>;

type TextVariant = NonNullable<TextVariantProps['variant']>;

const ROLE: Partial<Record<TextVariant, Role>> = {
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  blockquote: Platform.select({ web: 'blockquote' as Role }),
  code: Platform.select({ web: 'code' as Role }),
};

const ARIA_LEVEL: Partial<Record<TextVariant, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

const TextClassContext = React.createContext<string | undefined>(undefined);

function Text({
  className,
  asChild = false,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof RNText> &
  React.RefAttributes<typeof RNText> &
  TextVariantProps & {
    asChild?: boolean;
  }) {
  const textClass = React.useContext(TextClassContext);
  const Component = asChild ? Slot : RNText;
  return (
    <Component
      className={cn(textClass, textVariants({ variant }), className)}
      role={variant ? ROLE[variant] : undefined}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext };
