import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

// A minimal, non-floating tab bar docked to the bottom edge with a thin top
// border — no pill, no shadow, no animation. The active tab gets a static
// highlight. Screens must pad their bottom content so the last row clears it
// (see `TAB_BAR_CLEARANCE`).
export const TAB_BAR_CLEARANCE = 24;

export function FloatingTabBar({ state, navigation, descriptors }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className="flex-row border-t border-border bg-background px-2 pt-2"
      style={{ paddingBottom: Math.max(insets.bottom, 12) }}
    >
      {state.routes.map((route, index) => {
        const options = descriptors[route.key]?.options;
        const isActive = state.index === index;
        const IconComponent = options?.tabBarIcon;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isActive && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            onPress={onPress}
            className={cn(
              'flex-1 items-center justify-center gap-0.5 rounded-xl py-1.5',
              isActive && 'bg-primary-soft'
            )}
          >
            {IconComponent?.({ focused: isActive, color: '', size: 28 })}
            <Text
              className={cn('text-[11px] font-medium', isActive ? 'text-primary-soft-foreground' : 'text-muted-foreground')}
            >
              {String(options?.title ?? route.name)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TabIcon({ as, focused }: { as: React.ComponentProps<typeof Icon>['as']; focused: boolean }) {
  return (
    <Icon
      as={as}
      size={28}
      weight={focused ? 'fill' : 'regular'}
      className={focused ? 'text-primary' : 'text-muted-foreground'}
    />
  );
}
