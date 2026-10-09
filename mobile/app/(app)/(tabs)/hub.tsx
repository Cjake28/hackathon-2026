import { router } from 'expo-router';
import { Alarm, CaretRight, Cpu, GearSix, Lock, MapPin, Signpost, SpeakerHigh, User, WifiSlash } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAlarmsStore } from '@/hooks/useAlarms';
import { accents } from '@/lib/accents';
import { cn } from '@/lib/utils';
import type { AccentName } from '@/types';

const HUB = { name: 'Home hub', location: 'Living room', model: 'Local model · 8B', storage: '512 GB', uptimeDays: 23 };

const HUB_ROOMS = [
  { name: 'Living room', kind: 'Hub', listening: true },
  { name: 'Kitchen', kind: 'Speaker', listening: true },
  { name: "Ana's room", kind: 'Speaker', listening: true },
  { name: "Miguel's room", kind: 'Speaker', listening: false },
];

const ON_HUB_ONLY = [
  'Voice recordings and voice prints',
  'Face prints from the cameras',
  'Camera frames, including chore photos',
  'What each person has asked',
  'Who is home and which room they’re in',
];

const NEEDS_INTERNET = ['Where someone is when they’re out', 'Weather and typhoon alerts', 'Remote access while you’re away'];

function SectionLabel({ icon, children }: { icon: React.ComponentProps<typeof Icon>['as']; children: React.ReactNode }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon as={icon} weight="regular" size={18} className="text-muted-foreground" />
      <Text variant="label">{children}</Text>
    </View>
  );
}

function ManageRow({
  icon,
  accent,
  title,
  description,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  accent: AccentName;
  title: string;
  description: string;
  onPress: () => void;
}) {
  const tone = accents[accent];
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-3 py-3">
      <View className={cn('h-12 w-12 items-center justify-center rounded-full', tone.soft)}>
        <Icon as={icon} weight="regular" size={24} className={tone.onSoft} />
      </View>
      <View className="flex-1">
        <Text className="font-medium">{title}</Text>
        <Text variant="muted">{description}</Text>
      </View>
      <Icon as={CaretRight} weight="regular" size={20} className="text-muted-foreground" />
    </Pressable>
  );
}

// The box itself: what it is, where it listens, and what it keeps — and the
// short list of the handful of things that genuinely need the internet.
export default function HubScreen() {
  const insets = useSafeAreaInsets();
  const alarms = useAlarmsStore((state) => state.alarms);
  const activeAlarms = alarms.filter((alarm) => alarm.enabled).length;

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Hub</Text>
        <Text variant="muted">Your home's AI brain, always on</Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4" contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <Card className="items-center gap-3 py-8">
          <View className="relative">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary-soft">
              <Icon as={Cpu} weight="regular" size={36} className="text-primary-soft-foreground" />
            </View>
            <View className="absolute -bottom-0.5 -right-0.5 h-5 w-5 items-center justify-center rounded-full bg-card">
              <View className="h-3 w-3 rounded-full bg-success" />
            </View>
          </View>
          <View className="items-center gap-1.5">
            <Text variant="h3">{HUB.name}</Text>
            <Badge className="bg-success-soft">
              <Text className="text-success">Online</Text>
            </Badge>
          </View>
          <Text variant="muted" className="text-center">
            Sitting in the {HUB.location.toLowerCase()}, running a model on its own hardware.
          </Text>
          <View className="w-full flex-row justify-between px-6">
            <Text variant="small" className="text-success">{HUB.model}</Text>
            <Text variant="small" className="text-muted-foreground">{HUB.storage}</Text>
            <Text variant="small" className="text-muted-foreground">{HUB.uptimeDays} days up</Text>
          </View>
        </Card>

        <Card className="flex-row items-start gap-3 bg-accent-teal-soft p-4">
          <Icon as={WifiSlash} weight="regular" className="text-accent-teal-onSoft" size={24} />
          <View className="flex-1 gap-1">
            <Text className="font-medium text-accent-teal-onSoft">Works with the internet off</Text>
            <Text variant="small" className="text-accent-teal-onSoft">
              Voice, tasks, chores, alarms and blocking all run here. Only three things need a connection.
            </Text>
          </View>
        </Card>

        <View className="gap-2">
          <SectionLabel icon={SpeakerHigh}>Where it listens</SectionLabel>
          <Card className="p-4">
            <CardList>
              {HUB_ROOMS.map((room) => (
                <View key={room.name} className="flex-row items-center gap-3 py-2.5">
                  <Icon
                    as={SpeakerHigh}
                    weight="regular"
                    size={22}
                    className={room.listening ? 'text-primary' : 'text-destructive'}
                  />
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium" numberOfLines={1}>{room.name}</Text>
                    <Text variant="muted">{room.kind}</Text>
                  </View>
                  <Text variant="small" className={room.listening ? 'text-accent-teal-onSoft' : 'text-muted-foreground'}>
                    {room.listening ? 'Listening' : 'Mic off'}
                  </Text>
                </View>
              ))}
            </CardList>
          </Card>
        </View>

        <View className="gap-2">
          <SectionLabel icon={Lock}>What stays here</SectionLabel>
          <Text variant="muted">None of this leaves the house</Text>
          <Card className="p-4">
            <CardList>
              {ON_HUB_ONLY.map((item) => (
                <View key={item} className="flex-row items-start gap-2 py-2">
                  <Icon as={Lock} weight="regular" size={18} className="mt-0.5 text-accent-teal-base" />
                  <Text variant="small" className="flex-1">{item}</Text>
                </View>
              ))}
            </CardList>
          </Card>
        </View>

        <View className="gap-2">
          <SectionLabel icon={MapPin}>What needs the internet</SectionLabel>
          <Text variant="muted">These stop working when the line goes down</Text>
          <Card className="bg-sunken p-4">
            <CardList>
              {NEEDS_INTERNET.map((item) => (
                <View key={item} className="flex-row items-start gap-2 py-2">
                  <Icon as={MapPin} weight="regular" size={18} className="mt-0.5 text-accent-amber-base" />
                  <Text variant="small" className="flex-1 text-muted-foreground">{item}</Text>
                </View>
              ))}
            </CardList>
          </Card>
        </View>

        <View className="gap-2">
          <SectionLabel icon={GearSix}>Manage</SectionLabel>
          <Card className="p-4">
            <CardList>
              <ManageRow icon={Alarm} accent="amber" title="Alarms" description={activeAlarms === 1 ? '1 on' : `${activeAlarms} on`} onPress={() => router.push('/(app)/(tabs)/alarms')} />
              <ManageRow icon={Signpost} accent="violet" title="What's coming" description="Everything planned for Nova" onPress={() => router.push('/roadmap')} />
              <ManageRow icon={User} accent="azure" title="Your details" description="Name and email on this device" onPress={() => router.push('/personal-info')} />
              <ManageRow icon={GearSix} accent="teal" title="Settings" description="Hub behaviour and privacy" onPress={() => router.push('/settings')} />
            </CardList>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
