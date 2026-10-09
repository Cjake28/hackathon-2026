import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useAiStatus } from '@/hooks/useAi';
import { cn } from '@/lib/utils';

// Small status line: is the hub's local AI ready?
export function AiStatus() {
  const { data } = useAiStatus();
  if (!data) return null;

  const [color, text] = !data.online
    ? ['bg-red-500', 'Local AI offline: start Ollama on the hub']
    : data.missing.length
      ? ['bg-amber-500', `Model not downloaded: ollama pull ${data.missing[0]}`]
      : ['bg-green-500', `Local AI · ${data.model}`];

  return (
    <View className="flex-row items-center gap-2">
      <View className={cn('size-2 rounded-full', color)} />
      <Text className="text-xs text-muted-foreground">{text}</Text>
    </View>
  );
}
