import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { View } from 'react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

export function EmptyState({ icon, title, subtitle }: { icon: PhosphorIcon; title: string; subtitle?: string }) {
  return (
    <View className="items-center gap-2 px-8 py-16">
      <View className="mb-1 h-14 w-14 items-center justify-center rounded-full bg-sunken">
        <Icon as={icon} weight="fill" className="size-6 text-muted-foreground" />
      </View>
      <Text variant="large" className="text-center">
        {title}
      </Text>
      {subtitle ? <Text variant="muted" className="text-center">{subtitle}</Text> : null}
    </View>
  );
}
