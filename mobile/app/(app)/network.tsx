import { router } from 'expo-router';
import { DeviceMobile, DeviceTablet, GameController, Laptop, Question, ShieldWarning, Television, WifiHigh } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { describeRules, sortDevices, useNetworkStore } from '@/hooks/useNetwork';
import { can } from '@/lib/family-permissions';
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

// Everything on the home wifi, and what each one can reach. New devices get
// their own card up top rather than just sorting first — a row is too easy
// to scroll past for the one event here worth interrupting someone for.
export default function NetworkScreen() {
  const devices = useNetworkStore((state) => state.devices);
  const acknowledgeNew = useNetworkStore((state) => state.acknowledgeNew);
  const setPaused = useNetworkStore((state) => state.setPaused);
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();

  const canManage = can(speaker.role, 'network');
  const sorted = sortDevices(devices);
  const unknown = sorted.filter((device) => device.isNew);
  const known = sorted.filter((device) => !device.isNew);

  const online = devices.filter((device) => device.online).length;
  const paused = devices.filter((device) => device.paused).length;

  const guard = (run: () => void) => () => {
    if (!canManage) {
      Alert.alert('Only a parent can change the internet rules.');
      return;
    }
    run();
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Network" back />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <View className="flex-row justify-between">
          <Text variant="small" className="text-success">{online} connected</Text>
          <Text variant="small" className={paused > 0 ? 'text-warning' : 'text-muted-foreground'}>{paused} paused</Text>
        </View>

        {unknown.length > 0 ? (
          <Card className="gap-4 bg-accent-amber-soft p-4">
            <View className="flex-row items-start gap-3">
              <Icon as={ShieldWarning} weight="fill" size={20} className="text-accent-amber-onSoft" />
              <View className="flex-1 gap-0.5">
                <Text className="font-medium text-accent-amber-onSoft">
                  {unknown.length === 1 ? "A device you don't know joined the wifi" : `${unknown.length} devices you don't know joined the wifi`}
                </Text>
                <Text variant="small" className="text-accent-amber-onSoft">
                  Last seen {relativeTime(unknown[0].lastSeen)} ago. Adult sites are already blocked on it.
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onPress={guard(() => unknown.forEach((device) => acknowledgeNew(device.id)))}>
                <Text>I know this one</Text>
              </Button>
              <Button size="sm" className="flex-1" onPress={guard(() => unknown.forEach((device) => setPaused(device.id, true)))}>
                <Text className="text-primary-foreground">Cut it off</Text>
              </Button>
            </View>
          </Card>
        ) : null}

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Devices</Text>
            <Text variant="muted">Rules apply to the device</Text>
          </View>
          <View className="gap-2">
            {known.map((device) => {
              const owner = members.find((member) => member.id === device.ownerId);
              return (
                <Pressable key={device.id} onPress={() => router.push(`/device/${device.id}`)}>
                  <Card className="flex-row items-center gap-3 p-4">
                    <Icon
                      as={DEVICE_ICONS[device.kind]}
                      weight={device.online ? 'fill' : 'regular'}
                      size={20}
                      className={device.online ? 'text-primary' : 'text-muted-foreground'}
                    />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>{device.name}</Text>
                      <Text variant="muted" numberOfLines={1}>
                        {device.online ? (owner ? `${owner.name} · online` : 'Online') : `Last seen ${relativeTime(device.lastSeen)} ago`}
                      </Text>
                    </View>
                    <Badge variant={device.paused ? 'destructive' : device.blocked.length > 0 ? 'secondary' : 'outline'}>
                      <Text>{describeRules(device)}</Text>
                    </Badge>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card className="flex-row items-center gap-3 bg-sunken p-4">
          <Icon as={WifiHigh} size={20} className="text-accent-teal-base" />
          <Text variant="muted" className="flex-1">
            Blocking happens on the hub, so it works on every browser and app on that device — not just the ones that cooperate.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
