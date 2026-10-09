import { router } from 'expo-router';
import { MotiView } from 'moti';
import { CaretRight, GearSix, Microphone, WifiSlash } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { formatTime, sortAlarms, useAlarmsStore } from '@/hooks/useAlarms';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { openTasks, useTasksStore } from '@/hooks/useTasks';
import { SUGGESTED_COMMANDS, useVoiceStore } from '@/hooks/useVoice';

// The hub's face: what it's doing, who's in, what's outstanding. Everything
// here is a glance — anything that needs more fits its own tab.
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();
  const tasks = useTasksStore((state) => state.tasks);
  const alarms = useAlarmsStore((state) => state.alarms);
  const wake = useVoiceStore((state) => state.wake);
  const ask = useVoiceStore((state) => state.ask);

  const home = members.filter((member) => member.home);
  const outstanding = openTasks(tasks);
  const nextAlarms = sortAlarms(alarms.filter((alarm) => alarm.enabled)).slice(0, 3);
  const suggestions = SUGGESTED_COMMANDS[speaker.role] ?? [];

  const talk = () => {
    wake();
    router.push('/talk');
  };

  const runCommand = (command: string) => {
    ask(command, speaker);
    router.push('/talk');
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text variant="h3">Home hub</Text>
          <Text variant="muted">Living room · Local model · 8B</Text>
        </View>
        <Button variant="ghost" size="icon" onPress={() => router.push('/settings')}>
          <Icon as={GearSix} size={24} />
        </Button>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        <Card className="items-center gap-3 py-8">
          <MotiView
            from={{ scale: 1 }}
            animate={{ scale: 1.05 }}
            transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
          >
            <Button size="icon" className="h-24 w-24 rounded-full" onPress={talk}>
              <Icon as={Microphone} weight="fill" size={34} className="text-primary-foreground" />
            </Button>
          </MotiView>
          <Text className="text-base font-sans-semibold">Tap to talk to Nova</Text>
          <View className="w-full flex-row justify-center gap-2">
            <Badge className="bg-success-soft">
              <Text className="text-success">● On this hub</Text>
            </Badge>
            <Badge variant="secondary">
              <Text>No internet needed</Text>
            </Badge>
          </View>
        </Card>

        <View className="gap-2">
          <Text variant="label">Try saying</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
            {suggestions.map((command) => (
              <Button key={command} variant="secondary" size="sm" onPress={() => runCommand(command)}>
                <Text>{command}</Text>
              </Button>
            ))}
          </ScrollView>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Who's home</Text>
            <Text variant="muted">{home.length} of {members.length} in</Text>
          </View>
          <Card className="p-4">
            {home.length === 0 ? (
              <Text variant="muted">Nobody's in. Away mode is watching for movement.</Text>
            ) : (
              <CardList>
                {home.map((member) => (
                  <View key={member.id} className="flex-row items-center gap-3 py-2">
                    <FamilyAvatar member={member} size={44} />
                    <Text className="flex-1 font-medium" numberOfLines={1}>{member.name}</Text>
                    <Text variant="muted" numberOfLines={1}>{member.room ?? 'Somewhere in'}</Text>
                  </View>
                ))}
              </CardList>
            )}
          </Card>
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Still to do</Text>
            <Button variant="ghost" size="icon" onPress={() => router.push('/(app)/(tabs)/tasks')}>
              <Icon as={CaretRight} size={24} />
            </Button>
          </View>
          {outstanding.length === 0 ? (
            <Card className="bg-sunken p-6"><Text variant="muted" className="text-center">Nothing outstanding. Everyone's clear.</Text></Card>
          ) : (
            <View className="gap-2">
              {outstanding.slice(0, 3).map((task) => {
                const assignee = members.find((member) => member.id === task.assigneeId);
                return (
                  <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}`)}>
                    <Card className="flex-row items-center gap-3 p-3">
                      {assignee ? <FamilyAvatar member={assignee} size={42} /> : null}
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium" numberOfLines={1}>{task.title}</Text>
                        <Text variant="muted">{(assignee?.name ?? 'Unassigned')} · {task.due ?? 'No deadline'}</Text>
                      </View>
                      {task.status === 'submitted' ? <Badge variant="secondary"><Text>To check</Text></Badge> : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Next alarms</Text>
            <Button variant="ghost" size="icon" onPress={() => router.push('/(app)/(tabs)/alarms')}>
              <Icon as={CaretRight} size={24} />
            </Button>
          </View>
          <Card className="p-4">
            <CardList>
              {nextAlarms.map((alarm) => {
                const owner = members.find((member) => member.id === alarm.ownerId);
                return (
                  <View key={alarm.id} className="flex-row items-center gap-3 py-2">
                    {owner ? <FamilyAvatar member={owner} size={42} /> : null}
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>{formatTime(alarm.time)} · {alarm.label}</Text>
                      <Text variant="muted">{owner?.name ?? 'Someone'}</Text>
                    </View>
                  </View>
                );
              })}
            </CardList>
          </Card>
        </View>

        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 400, delay: 150 }}
        >
          <Card className="flex-row items-center gap-3 bg-accent-teal-soft p-4">
            <MotiView
              from={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              transition={{ type: 'timing', duration: 1100, loop: true, repeatReverse: true }}
              className="h-10 w-10 items-center justify-center rounded-full bg-card"
            >
              <Icon as={WifiSlash} weight="fill" className="text-accent-teal-onSoft" size={20} />
            </MotiView>
            <View className="flex-1 gap-0.5">
              <Text className="font-medium text-accent-teal-onSoft">Works with the internet off</Text>
              <Text variant="small" className="text-accent-teal-onSoft">
                Nothing you say on this screen ever leaves the house.
              </Text>
            </View>
          </Card>
        </MotiView>
      </ScrollView>
    </View>
  );
}
