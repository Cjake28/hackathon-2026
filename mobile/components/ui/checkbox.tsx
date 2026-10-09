import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Check } from 'phosphor-react-native';
import { Platform } from 'react-native';

const DEFAULT_HIT_SLOP = 24;

function Checkbox({
  className,
  checkedClassName,
  indicatorClassName,
  iconClassName,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & {
    checkedClassName?: string;
    indicatorClassName?: string;
    iconClassName?: string;
  }) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        // ARC_LIGHT: no border — the sunken fill carries the unchecked state.
        'bg-sunken dark:bg-input/30 size-4 shrink-0 rounded-[4px]',
        Platform.select({
          web: 'focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 peer cursor-default outline-none transition-shadow focus-visible:ring-[3px] disabled:cursor-not-allowed',
          native: 'overflow-hidden',
        }),
        props.checked && checkedClassName,
        props.disabled && 'opacity-50',
        className
      )}
      hitSlop={DEFAULT_HIT_SLOP}
      {...props}>
      <CheckboxPrimitive.Indicator
        className={cn('bg-primary h-full w-full items-center justify-center', indicatorClassName)}>
        <Icon
          as={Check}
          weight="bold"
          size={12}
          className={cn('text-primary-foreground', iconClassName)}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
