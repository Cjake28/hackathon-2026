import { router } from 'expo-router';
import { Alarm, Basket, Brain, CalendarBlank, CaretRight, Cpu, GearSix, Lock, MapPin, NavigationArrow, ShieldCheck, Signpost, SpeakerHigh, User, UsersThree, Wallet, WifiSlash } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useHubAlarms } from '@/hooks/useHub';
import { accents } from '@/lib/accents';
import { cn } from '@/lib/utils';
import type { AccentName } from '@/types';
import { useRefresher } from '@/components/Refresher';

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
  const refresher = useRefresher();
  const insets = useSafeAreaInsets();
  const can = useCan();
  const { data: alarms = [] } = useHubAlarms(can('alarms.family') ? { all: true } : {});
  const activeAlarms = alarms.filter((alarm) => alarm.enabled).length;

  return (
    <View className="flex-1 bg-background">
      <View className="px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Hub</Text>
        <Text variant="muted">Your home's AI brain, always on</Text>
      </View>

      <ScrollView refreshControl={refresher} className="flex-1" contentContainerClassName="gap-6 px-4" contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        {/* Chunky 3D panel, same as the home screen: green face on a darker green edge. */}
        <View className="rounded-3xl bg-primary-edge pb-1.5">
          <Card className="items-center gap-4 border-0 bg-primary py-8">
            <View className="relative">
              <View className="h-24 w-24 items-center justify-center rounded-full bg-white/20">
                <Icon as={Cpu} weight="fill" size={38} className="text-white" />
              </View>
              <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full bg-primary">
                <View className="h-3 w-3 rounded-full bg-white" />
              </View>
            </View>
            <View className="items-center gap-1">
              <Text className="text-xl font-sans-bold text-white">{HUB.name}</Text>
              <Text variant="small" className="text-center text-white/80">
                Sitting in the {HUB.location.toLowerCase()}, running on its own hardware
              </Text>
            </View>
            <View className="w-full flex-row flex-wrap justify-center gap-2 px-4">
              <Badge className="bg-white/20">
                <Text className="text-white">● Online</Text>
              </Badge>
              <Badge className="bg-white/20">
                <Text className="text-white">{HUB.model}</Text>
              </Badge>
              <Badge className="bg-white/20">
                <Text className="text-white">{HUB.uptimeDays} days up</Text>
              </Badge>
              <Badge className="bg-white/20">
                <Text className="text-white">{HUB.storage}</Text>
              </Badge>
            </View>
          </Card>
        </View>

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
          <Text variant="label">Where it listens</Text>
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
          <Text variant="label">What stays here</Text>
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
          <Text variant="label">What needs the internet</Text>
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
          <Text variant="label">Manage</Text>
          <Card className="p-4">
            <CardList>
              <ManageRow icon={Basket} accent="teal" title="Grocery" description="The household shopping list" onPress={() => router.push("/grocery")} />
              <ManageRow icon={Brain} accent="rose" title="What Onai remembers" description="Notes about each person, delete any" onPress={() => router.push("/memory")} />
              {can('calendar.use') ? (
                <ManageRow icon={CalendarBlank} accent="azure" title="Calendar" description="What is coming up this week" onPress={() => router.push("/calendar")} />
              ) : null}
              {can('budget.use') ? (
                <ManageRow icon={Wallet} accent="violet" title="Budget" description="What the house spent this month" onPress={() => router.push("/budget")} />
              ) : null}
              {can('location.read') ? (
                <ManageRow icon={NavigationArrow} accent="amber" title="Where everyone is" description="Who's home, out, or at school" onPress={() => router.push('/whereabouts')} />
              ) : null}
              <ManageRow icon={Alarm} accent="amber" title="Alarms" description={activeAlarms === 1 ? '1 on' : `${activeAlarms} on`} onPress={() => router.push('/(app)/(tabs)/alarms')} />
              {can('users.manage') ? (
                <ManageRow icon={UsersThree} accent="arc" title="Family accounts" description="Make a login for someone in the house" onPress={() => router.push('/accounts')} />
              ) : null}
              {can('roles.manage') ? (
                <ManageRow icon={ShieldCheck} accent="teal" title="Roles" description="What each role is allowed to do" onPress={() => router.push('/roles')} />
              ) : null}
              <ManageRow icon={Signpost} accent="violet" title="What's coming" description="Everything planned for Onai" onPress={() => router.push('/roadmap')} />
              <ManageRow icon={User} accent="azure" title="Your details" description="Name and email on this device" onPress={() => router.push('/personal-info')} />
              <ManageRow icon={GearSix} accent="teal" title="Settings" description="Hub behaviour and privacy" onPress={() => router.push('/settings')} />
            </CardList>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
