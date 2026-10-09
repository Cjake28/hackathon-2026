import { router } from 'expo-router';
import { CaretLeft } from 'phosphor-react-native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

// Every screen owns its own header — there's no global top bar (matches Nova).
export function ScreenHeader({
  title,
  subtitle,
  back = false,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-row items-center gap-2 px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
      {back && (
        <Button variant="ghost" size="icon" onPress={() => router.back()}>
          <Icon as={CaretLeft} />
        </Button>
      )}
      <View className="flex-1">
        <Text variant="h3">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
