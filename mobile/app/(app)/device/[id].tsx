import { router, useLocalSearchParams } from 'expo-router';
import { Check, DeviceMobile, DeviceTablet, GameController, Laptop, Question, Television } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { BLOCK_CATEGORIES, useNetworkStore } from '@/hooks/useNetwork';
import { can } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/time';
import type { DeviceKind } from '@/types';

const DEVICE_ICONS: Record<DeviceKind, React.ComponentProps<typeof Icon>['as']> = {
  phone: DeviceMobile,
  laptop: Laptop,
  tablet: DeviceTablet,
  tv: Television,
  console: GameController,
  unknown: Question,
};

// One device and its rules. Pausing sits above the category list — it's the
// blunt instrument parents reach for first.
export default function DeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const devices = useNetworkStore((state) => state.devices);
  const toggleCategory = useNetworkStore((state) => state.toggleCategory);
  const setPaused = useNetworkStore((state) => state.setPaused);
  const claimDevice = useNetworkStore((state) => state.claimDevice);

  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();
  const canManage = can(speaker.role, 'network');

  const device = devices.find((item) => item.id === id);

  if (!device) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Device" back />
        <EmptyState icon={Question} title="This device is gone" subtitle="It may have left the network." />
        <View className="items-center">
          <Button variant="secondary" onPress={() => router.replace('/network')}><Text>Back to network</Text></Button>
        </View>
      </View>
    );
  }

  const owner = members.find((member) => member.id === device.ownerId);

  const guard = (run: () => void) => {
    if (!canManage) {
      Alert.alert('Only a parent can change the internet rules.');
      return;
    }
    run();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={device.name} subtitle={device.online ? 'Connected now' : `Last seen ${relativeTime(device.lastSeen)} ago`} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-primary-soft">
            <Icon as={DEVICE_ICONS[device.kind]} weight="fill" size={28} className="text-primary-soft-foreground" />
          </View>
          <Text variant="h3">{device.name}</Text>
          <Text variant="muted">{owner ? `${owner.name}'s device` : 'Nobody has claimed this device yet.'}</Text>
          <View className="w-full flex-row justify-between px-10">
            <Text variant="small" className={device.paused ? 'text-destructive' : 'text-success'}>{device.paused ? 'Paused' : 'Allowed'}</Text>
            <Text variant="small" className="text-muted-foreground">{device.blocked.length} groups blocked</Text>
          </View>
        </Card>

        <View className="gap-2">
          <Text variant="label">Internet</Text>
          <Card className="flex-row items-center gap-4 p-4">
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Pause the internet</Text>
              <Text variant="small" className="text-muted-foreground">Cuts this device off entirely. Everything else in the house carries on.</Text>
            </View>
            <Checkbox checked={device.paused} onCheckedChange={(next) => guard(() => setPaused(device.id, next))} />
          </Card>
        </View>

        <View className="gap-2">
          <Text variant="label">What it can reach</Text>
          <Text variant="muted">{device.paused ? 'Nothing right now — the internet is paused' : 'Tap a group to block it'}</Text>
          <View className="gap-2">
            {BLOCK_CATEGORIES.map((category) => {
              const blocked = device.blocked.includes(category.key);
              return (
                <Pressable
                  key={category.key}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: blocked }}
                  onPress={() => guard(() => toggleCategory(device.id, category.key))}
                  className={cn('flex-row items-center gap-3 rounded-md bg-card p-4', device.paused && 'opacity-55')}
                >
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium">{category.label}</Text>
                    <Text variant="small" className="text-muted-foreground">{category.examples}</Text>
                  </View>
                  <View className={cn('h-6 w-6 items-center justify-center rounded-full bg-sunken', blocked && 'bg-primary')}>
                    {blocked ? <Icon as={Check} weight="fill" size={14} className="text-primary-foreground" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!owner ? (
          <View className="gap-2">
            <Text variant="label">Whose is it?</Text>
            <Card className="gap-3 p-4">
              <Text variant="small" className="text-muted-foreground">
                Claiming a device applies that person's usual rules to it and stops it being flagged as unknown.
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {members.filter((member) => member.role !== 'guest').map((member) => (
                  <Button key={member.id} variant="secondary" size="sm" onPress={() => guard(() => claimDevice(device.id, member.id))}>
                    <Text>{member.name}</Text>
                  </Button>
                ))}
              </View>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
