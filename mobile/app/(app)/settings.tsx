import { router } from 'expo-router';
import {
  Bell,
  Brain,
  ChatCircleDots,
  Microphone,
  ShieldCheck,
  SignOut,
  UsersThree,
  Vibrate,
  WifiHigh,
} from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardList } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan, useLogout, useMe } from '@/hooks/useAuth';
import { useFloatingBubble } from '@/hooks/useFloatingBubble';
import { useHubFamily } from '@/hooks/useHub';
import { usePreferencesStore } from '@/hooks/usePreferences';

function PreferenceRow({
  icon,
  title,
  description,
  value,
  onValueChange,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <Icon as={icon} size={20} className="text-primary" />
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        <Text variant="small" className="text-muted-foreground">
          {description}
        </Text>
      </View>
      <Checkbox checked={value} onCheckedChange={onValueChange} />
    </View>
  );
}

function LinkRow({
  icon,
  title,
  description,
  onPress,
  testID,
  destructive,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  title: string;
  description: string;
  onPress: () => void;
  testID?: string;
  destructive?: boolean;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} className="flex-row items-center gap-3 py-3">
      <Icon as={icon} size={20} className={destructive ? 'text-destructive' : 'text-primary'} />
      <View className="flex-1 gap-0.5">
        <Text className={destructive ? 'font-medium text-destructive' : 'font-medium'}>{title}</Text>
        <Text variant="small" className="text-muted-foreground">
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

// Settings grouped by what each switch changes: how the hub listens, what it
// remembers, and what it does to this phone. The privacy commitments live on
// the Hub tab — these are the controls.
export default function SettingsScreen() {
  const can = useCan();
  const { data: me } = useMe();
  const logout = useLogout();
  const { data: people = [] } = useHubFamily();

  const wakeWord = usePreferencesStore((state) => state.wakeWord);
  const memory = usePreferencesStore((state) => state.memory);
  const announcements = usePreferencesStore((state) => state.announcements);
  const haptics = usePreferencesStore((state) => state.haptics);
  const notifications = usePreferencesStore((state) => state.notifications);
  const setPreference = usePreferencesStore((state) => state.setPreference);

  const { floating, float } = useFloatingBubble();

  const confirmSwitch = () =>
    Alert.alert(
      'Switch person?',
      'This phone stops ringing for your alarms until you log back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Switch person', onPress: () => logout.mutate() },
      ],
    );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Settings" />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        {me ? (
          <Card className="flex-row items-center gap-4 p-4">
            <FamilyAvatar member={me} size={56} />
            <View className="flex-1 gap-0.5">
              <Text variant="large" numberOfLines={1}>
                {me.name}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                {me.role} · {me.email}
              </Text>
            </View>
          </Card>
        ) : null}

        <View className="gap-1">
          <Text variant="label">Listening</Text>
          <Text variant="muted">How Jarvis hears you</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow
                icon={Microphone}
                title="Wake word"
                description="Listen for “Hey Jarvis” rather than waiting for a tap."
                value={wakeWord}
                onValueChange={(next) => setPreference('wakeWord', next)}
              />
              <PreferenceRow
                icon={Bell}
                title="Speak out loud"
                description="Announce arrivals, alarms and finished chores in the room."
                value={announcements}
                onValueChange={(next) => setPreference('announcements', next)}
              />
            </CardList>
          </Card>
        </View>

        <View className="gap-1">
          <Text variant="label">Memory</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow
                icon={Brain}
                title="Remember preferences"
                description="Let Jarvis carry what you like across conversations."
                value={memory}
                onValueChange={(next) => setPreference('memory', next)}
              />
              <LinkRow
                icon={Brain}
                title="What Jarvis remembers about you"
                description="Read every note, and delete any of them"
                onPress={() => router.push('/memory')}
                testID="settings-memory"
              />
            </CardList>
          </Card>
        </View>

        {can('users.manage') || can('roles.manage') ? (
          <View className="gap-1">
            <Text variant="label">The household</Text>
            <Text variant="muted">{people.length} people on this hub</Text>
            <Card className="p-4">
              <CardList>
                {can('users.manage') ? (
                  <LinkRow
                    icon={UsersThree}
                    title="Family accounts"
                    description="Make a login for someone, or change theirs"
                    onPress={() => router.push('/accounts')}
                    testID="settings-accounts"
                  />
                ) : null}
                {can('roles.manage') ? (
                  <LinkRow
                    icon={ShieldCheck}
                    title="Roles"
                    description="What each role is allowed to do"
                    onPress={() => router.push('/roles')}
                    testID="settings-roles"
                  />
                ) : null}
              </CardList>
            </Card>
          </View>
        ) : null}

        <View className="gap-1">
          <Text variant="label">This phone</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow
                icon={Bell}
                title="Notifications"
                description="Tell me when a task lands or an alarm goes off."
                value={notifications}
                onValueChange={(next) => setPreference('notifications', next)}
              />
              <PreferenceRow
                icon={Vibrate}
                title="Haptics"
                description="A small tap when you press something."
                value={haptics}
                onValueChange={(next) => setPreference('haptics', next)}
              />
              <PreferenceRow
                icon={ChatCircleDots}
                title="Keep Jarvis on screen"
                description="A circle you can drag anywhere, on your home screen and over other apps. Tap it to talk."
                value={floating}
                onValueChange={float}
              />
              <LinkRow
                icon={SignOut}
                title="Switch person"
                description="Log out, so someone else can use this phone"
                onPress={confirmSwitch}
                testID="settings-switch-person"
                destructive
              />
            </CardList>
          </Card>
        </View>

        <View className="gap-1">
          <Text variant="label">Network</Text>
          <Card className="p-4">
            <Pressable onPress={() => router.push('/network')} className="flex-row items-center gap-3">
              <Icon as={WifiHigh} size={20} className="text-primary" />
              <View className="flex-1 gap-0.5">
                <Text className="font-medium">Site blocking</Text>
                <Text variant="small" className="text-muted-foreground">
                  What each device on the wifi can reach
                </Text>
              </View>
            </Pressable>
          </Card>
        </View>

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-center text-muted-foreground">
            Jarvis · Version 1.0.0
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
