import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform, Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

// Duolingo-style chunky pill: a flat-colour face sitting on a solid darker
// "edge" a few px tall. Pressing the face slides it down into the edge —
// see the `edge` map below. Only the filled variants (default/destructive/
// secondary/outline) get this; ghost/link stay flat, text-only presses.
const EDGE_HEIGHT = { default: 4, sm: 3, lg: 5, icon: 4 } as const;

// Icon buttons are perfect circles (rounded-full); every other size is a
// chunky rounded rect (rounded-2xl) — kept out of the shared base so the two
// never collide in the same class string.
const RADIUS = { default: 'rounded-2xl', sm: 'rounded-2xl', lg: 'rounded-2xl', icon: 'rounded-full' } as const;

const faceVariants = cva(
  cn(
    'group shrink-0 flex-row items-center justify-center gap-2',
    Platform.select({
      web: "focus-visible:ring-ring/50 whitespace-nowrap outline-none transition-colors focus-visible:ring-[3px] disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    })
  ),
  {
    variants: {
      variant: {
        default: 'bg-primary',
        destructive: 'bg-destructive',
        outline: 'bg-sunken',
        secondary: 'bg-secondary',
        ghost: cn('active:bg-accent dark:active:bg-accent/50', Platform.select({ web: 'hover:bg-accent dark:hover:bg-accent/50' })),
        link: '',
      },
      size: {
        default: cn('h-12 px-5', RADIUS.default, Platform.select({ web: 'has-[>svg]:px-4' })),
        sm: cn('h-10 gap-1.5 px-4', RADIUS.sm, Platform.select({ web: 'has-[>svg]:px-3' })),
        lg: cn('h-14 px-7', RADIUS.lg, Platform.select({ web: 'has-[>svg]:px-5' })),
        icon: cn('h-12 w-12', RADIUS.icon),
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

/** Edge colour beneath each filled variant's face. Flat variants get none. */
const edgeClassByVariant: Record<string, string | undefined> = {
  default: 'bg-primary-edge',
  destructive: 'bg-destructive-edge',
  outline: 'bg-sunken-edge',
  secondary: 'bg-secondary-edge',
  ghost: undefined,
  link: undefined,
};

const buttonTextVariants = cva(
  cn('text-foreground text-sm font-sans-bold', Platform.select({ web: 'pointer-events-none transition-colors' })),
  {
    variants: {
      variant: {
        default: 'text-primary-foreground',
        destructive: 'text-white',
        outline: cn('group-active:text-accent-foreground', Platform.select({ web: 'group-hover:text-accent-foreground' })),
        secondary: 'text-secondary-foreground',
        ghost: 'group-active:text-accent-foreground',
        link: cn('text-primary group-active:underline', Platform.select({ web: 'underline-offset-4 hover:underline group-hover:underline' })),
      },
      size: {
        default: '',
        sm: '',
        lg: '',
        icon: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonProps = React.ComponentProps<typeof Pressable> &
  React.RefAttributes<typeof Pressable> &
  VariantProps<typeof faceVariants>;

function Button({ className, variant = 'default', size = 'default', onPressIn, onPressOut, ...props }: ButtonProps) {
  const edgeClass = edgeClassByVariant[variant ?? 'default'];
  const edgeHeight = EDGE_HEIGHT[(size ?? 'default') as keyof typeof EDGE_HEIGHT];
  const press = useSharedValue(0);

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: press.value }] }));

  // No edge (ghost/link): render the flat Pressable as before.
  if (!edgeClass) {
    return (
      <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
        <Pressable
          className={cn(props.disabled && 'opacity-50', faceVariants({ variant, size }), className)}
          role="button"
          {...props}
        />
      </TextClassContext.Provider>
    );
  }

  return (
    <TextClassContext.Provider value={buttonTextVariants({ variant, size })}>
      <View
        className={cn(RADIUS[(size ?? 'default') as keyof typeof RADIUS], edgeClass, props.disabled && 'opacity-50')}
        style={{ paddingBottom: edgeHeight }}
      >
        <AnimatedPressable
          className={cn(faceVariants({ variant, size }), className)}
          style={faceStyle}
          role="button"
          onPressIn={(event) => {
            press.value = withTiming(edgeHeight, { duration: 80 });
            onPressIn?.(event);
          }}
          onPressOut={(event) => {
            press.value = withTiming(0, { duration: 80 });
            onPressOut?.(event);
          }}
          {...props}
        />
      </View>
    </TextClassContext.Provider>
  );
}

export { Button, buttonTextVariants, faceVariants as buttonVariants };
export type { ButtonProps };
