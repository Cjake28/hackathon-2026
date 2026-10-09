import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps } from 'phosphor-react-native';
import { cssInterop } from 'nativewind';
import * as React from 'react';

type IconProps = PhosphorIconProps & {
  as: PhosphorIcon;
  className?: string;
} & React.RefAttributes<PhosphorIcon>;

function IconImpl({ as: IconComponent, ...props }: IconProps) {
  return <IconComponent {...props} />;
}

cssInterop(IconImpl, {
  className: {
    target: 'style',
    nativeStyleToProp: {
      height: 'size',
      width: 'size',
      color: 'color',
    },
  },
});

/**
 * A wrapper component for Phosphor icons with Nativewind `className` support via `cssInterop`.
 *
 * This component allows you to render any Phosphor icon while applying utility classes
 * using `nativewind`. It avoids the need to wrap or configure each icon individually.
 *
 * @component
 * @example
 * ```tsx
 * import { ArrowRight } from 'phosphor-react-native';
 * import { Icon } from '@/components/ui/icon';
 *
 * <Icon as={ArrowRight} className="text-red-500" size={16} weight="fill" />
 * ```
 *
 * @param {PhosphorIcon} as - The Phosphor icon component to render.
 * @param {string} className - Utility classes to style the icon using Nativewind.
 * @param {number} size - Icon size (defaults to 20).
 * @param {...PhosphorIconProps} ...props - Additional Phosphor icon props passed to the "as" icon (e.g. `weight`).
 */
function Icon({ as: IconComponent, className, size = 20, ...props }: IconProps) {
  const textClass = React.useContext(TextClassContext);
  return (
    <IconImpl
      as={IconComponent}
      className={cn('text-foreground', textClass, className)}
      size={size}
      {...props}
    />
  );
}

export { Icon };
