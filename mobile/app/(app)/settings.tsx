import { router } from 'expo-router';
import { Bell, Brain, Microphone, Trash, Vibrate, WifiHigh } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardList } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore } from '@/hooks/useFamily';
import { usePreferencesStore } from '@/hooks/usePreferences';
import { useTasksStore } from '@/hooks/useTasks';

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
        <Text variant="small" className="text-muted-foreground">{description}</Text>
      </View>
      <Checkbox checked={value} onCheckedChange={onValueChange} />
    </View>
  );
}

// Settings grouped by what each switch changes: how the hub listens, what it
// remembers, and what it does to this phone. The privacy commitments live on
// the Hub tab — these are the controls.
export default function SettingsScreen() {
  const wakeWord = usePreferencesStore((state) => state.wakeWord);
  const memory = usePreferencesStore((state) => state.memory);
  const announcements = usePreferencesStore((state) => state.announcements);
  const haptics = usePreferencesStore((state) => state.haptics);
  const notifications = usePreferencesStore((state) => state.notifications);
  const setPreference = usePreferencesStore((state) => state.setPreference);

  const members = useFamilyStore((state) => state.members);
  const tasks = useTasksStore((state) => state.tasks);
  const enrolled = members.filter((member) => member.voice === 'enrolled');

  const confirmForget = () => {
    Alert.alert(
      'Forget everything?',
      'Voice prints, face prints and everything the hub has remembered about each person will be deleted from this device. Tasks and alarms are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget it all',
          style: 'destructive',
          onPress: () => {
            const { members: all, setRecognition } = useFamilyStore.getState();
            all.forEach((member) => {
              setRecognition(member.id, 'voice', 'none');
              setRecognition(member.id, 'face', 'none');
            });
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Settings" />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <View className="gap-1">
          <Text variant="label">Listening</Text>
          <Text variant="muted">How Nova hears you</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow icon={Microphone} title="Wake word" description="Listen for “Hey Nova” rather than waiting for a tap." value={wakeWord} onValueChange={(next) => setPreference('wakeWord', next)} />
              <PreferenceRow icon={Bell} title="Speak out loud" description="Announce arrivals, alarms and finished chores in the room." value={announcements} onValueChange={(next) => setPreference('announcements', next)} />
            </CardList>
          </Card>
        </View>

        <View className="gap-1">
          <Text variant="label">Memory</Text>
          <Text variant="muted">{enrolled.length} of {members.length} voices known</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow icon={Brain} title="Remember preferences" description="Carry what each person likes across conversations." value={memory} onValueChange={(next) => setPreference('memory', next)} />
              <Pressable onPress={confirmForget} className="flex-row items-center gap-3 py-3">
                <Icon as={Trash} size={20} className="text-destructive" />
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium text-destructive">Forget everyone</Text>
                  <Text variant="small" className="text-muted-foreground">Deletes every voice and face print from the hub</Text>
                </View>
              </Pressable>
            </CardList>
          </Card>
        </View>

        <View className="gap-1">
          <Text variant="label">This phone</Text>
          <Card className="p-4">
            <CardList>
              <PreferenceRow icon={Bell} title="Notifications" description="Tell me when a task lands or a chore needs checking." value={notifications} onValueChange={(next) => setPreference('notifications', next)} />
              <PreferenceRow icon={Vibrate} title="Haptics" description="A small tap when you press something." value={haptics} onValueChange={(next) => setPreference('haptics', next)} />
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
                <Text variant="small" className="text-muted-foreground">What each device on the wifi can reach</Text>
              </View>
            </Pressable>
          </Card>
        </View>

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-center text-muted-foreground">
            Nova · {tasks.length} tasks on this hub · Version 1.0.0
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
