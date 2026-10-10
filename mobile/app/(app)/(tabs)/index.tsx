import { router } from 'expo-router';
import { MotiView } from 'moti';
import * as Speech from 'expo-speech';
import {
  ArrowCounterClockwise,
  CaretRight,
  GearSix,
  Microphone,
  SpeakerHigh,
  Sun,
  X,
} from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { MarkdownText } from '@/components/MarkdownText';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useBriefing, useHubAlarms, useHubFamily, useHubTasks } from '@/hooks/useHub';
import { formatTime } from '@/lib/time';
import { useRefresher } from '@/components/Refresher';

// What a parent is most likely to say; kids get the shorter list.
const SUGGESTIONS: Record<string, string[]> = {
  parent: [
    'Tell Ben to put the bins out',
    'Wake Ana up at 6:15 tomorrow',
    'Add rice to the grocery list',
    "Who's home?",
  ],
  child: ['Set an alarm for 7 oʼclock', "What's on my list today?", 'Add pandesal to the grocery list'],
  guest: ['What time is it?'],
};

// The hub's face: what it's doing, who's in, what's outstanding. Everything
// here is a glance — anything that needs more fits its own tab.
export default function HomeScreen() {
  const refresher = useRefresher();
  const insets = useSafeAreaInsets();
  const can = useCan();
  const { data: me } = useMe();

  const { data: people = [] } = useHubFamily();
  const { data: tasks = [] } = useHubTasks(can('tasks.assign'));
  const { data: alarms = [] } = useHubAlarms(can('alarms.family') ? { all: true } : {});
  const briefing = useBriefing();
  const [briefingOpen, setBriefingOpen] = useState(false);

  const home = people.filter((person) => person.isHome);
  const outstanding = tasks.filter((task) => task.status !== 'done').slice(0, 3);
  const nextAlarms = alarms.filter((alarm) => alarm.enabled).slice(0, 3);
  const suggestions = SUGGESTIONS[me?.role ?? 'child'] ?? SUGGESTIONS.child;

  const nameOf = (userId: number) =>
    userId === me?.id ? 'You' : (people.find((p) => p.id === userId)?.name ?? 'Someone');

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text variant="h3">Hi {me?.name?.split(' ')[0] ?? 'there'}</Text>
          <Text variant="muted">Your home hub · runs on this house</Text>
        </View>
        <Button variant="ghost" size="icon" onPress={() => router.push('/settings')}>
          <Icon as={GearSix} size={24} />
        </Button>
      </View>

      <ScrollView refreshControl={refresher}
        className="flex-1"
        contentContainerClassName="gap-6 px-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        showsVerticalScrollIndicator={false}
      >
        {/* Chunky 3D panel: the green face sits on a darker green edge. */}
        <View className="rounded-3xl bg-primary-edge pb-1.5">
          <Card className="items-center gap-4 border-0 bg-primary py-10">
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: 1.05 }}
              transition={{ type: 'timing', duration: 900, loop: true, repeatReverse: true }}
            >
              <Pressable
                testID="home-talk"
                onPress={() => router.push('/talk')}
                className="h-24 w-24 items-center justify-center rounded-full bg-white/20"
              >
                <Icon as={Microphone} weight="fill" size={38} className="text-white" />
              </Pressable>
            </MotiView>
            <View className="items-center gap-1">
              <Text className="text-xl font-sans-bold text-white">Tap to talk to Onai</Text>
              <Text variant="small" className="text-white/80">
                Ask for anything, out loud
              </Text>
            </View>
            <View className="w-full flex-row justify-center gap-2">
              <Badge className="bg-white/20">
                <Text className="text-white">● On this hub</Text>
              </Badge>
              <Badge className="bg-white/20">
                <Text className="text-white">No internet needed</Text>
              </Badge>
            </View>
          </Card>
        </View>

        {can('ai.use') ? (
          <Button
            testID="home-briefing"
            variant="secondary"
            disabled={briefing.isPending}
            onPress={() => {
              setBriefingOpen(true);
              briefing.mutate();
            }}
          >
            <Icon as={Sun} weight="fill" size={20} />
            <Text>Good morning — what’s my day?</Text>
          </Button>
        ) : null}

        <View className="gap-2">
          <Text variant="label">Try saying</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-4"
            contentContainerClassName="gap-2 px-4"
          >
            {suggestions.map((command) => (
              <Button
                key={command}
                variant="secondary"
                size="sm"
                onPress={() => router.push({ pathname: '/talk', params: { say: command } })}
              >
                <Text>{command}</Text>
              </Button>
            ))}
          </ScrollView>
        </View>

        {people.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="label">Who's home</Text>
              <Text variant="muted">
                {home.length} of {people.length} in
              </Text>
            </View>
            <Card className="p-4">
              {home.length === 0 ? (
                <Text variant="muted">Nobody's in.</Text>
              ) : (
                <CardList>
                  {home.map((person) => (
                    <View key={person.id} className="flex-row items-center gap-3 py-2">
                      <FamilyAvatar member={person} size={44} />
                      <Text className="flex-1 font-medium" numberOfLines={1}>
                        {person.name}
                      </Text>
                      <Text variant="muted" numberOfLines={1}>
                        {person.id === me?.id ? 'This phone' : 'Home'}
                      </Text>
                    </View>
                  ))}
                </CardList>
              )}
            </Card>
          </View>
        ) : null}

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Still to do</Text>
            <Button variant="ghost" size="icon" onPress={() => router.push('/(app)/(tabs)/tasks')}>
              <Icon as={CaretRight} size={24} />
            </Button>
          </View>
          {outstanding.length === 0 ? (
            <Card className="bg-sunken p-6">
              <Text variant="muted" className="text-center">
                Nothing outstanding. Everyone's clear.
              </Text>
            </Card>
          ) : (
            <View className="gap-2">
              {outstanding.map((task) => (
                <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}`)}>
                  <Card className="flex-row items-center gap-3 p-3">
                    <FamilyAvatar member={{ id: task.assigneeId, name: task.assigneeName }} size={42} />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>
                        {task.title}
                      </Text>
                      <Text variant="muted">
                        {task.assigneeName} ·{' '}
                        {task.dueAt ? `due ${new Date(task.dueAt).toLocaleTimeString()}` : 'no deadline'}
                      </Text>
                    </View>
                    {task.isChore ? (
                      <Badge variant="outline">
                        <Text>10 pts</Text>
                      </Badge>
                    ) : null}
                  </Card>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {nextAlarms.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="label">Next alarms</Text>
              <Button variant="ghost" size="icon" onPress={() => router.push('/(app)/(tabs)/alarms')}>
                <Icon as={CaretRight} size={24} />
              </Button>
            </View>
            <Card className="p-4">
              <CardList>
                {nextAlarms.map((alarm) => (
                  <View key={alarm.id} className="flex-row items-center gap-3 py-2">
                    <FamilyAvatar member={{ id: alarm.userId, name: nameOf(alarm.userId) }} size={42} />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>
                        {formatTime(alarm.time)} · {alarm.label}
                      </Text>
                      <Text variant="muted">{nameOf(alarm.userId)}</Text>
                    </View>
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        ) : null}

      </ScrollView>

      <BriefingSheet
        open={briefingOpen}
        thinking={briefing.isPending}
        text={briefing.data?.text}
        onClose={() => {
          setBriefingOpen(false);
          briefing.reset();
        }}
      />
    </View>
  );
}

// Onai's run-through of the day. It arrives spoken — the phone reads it out the
// moment it's ready, so you can be making breakfast — and the words stay on screen
// underneath for anyone who'd rather read them.
function BriefingSheet({
  open,
  thinking,
  text,
  onClose,
}: {
  open: boolean;
  thinking: boolean;
  text?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [speaking, setSpeaking] = useState(false);

  const say = (what: string) => {
    Speech.stop();
    setSpeaking(true);
    // Strip the Markdown marks: the voice shouldn't read out asterisks.
    Speech.speak(what.replace(/[*#_`>]/g, ''), {
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  // Read it out as soon as it lands, and stop the moment the sheet closes.
  useEffect(() => {
    if (open && text) say(text);
  }, [open, text]);

  useEffect(() => {
    if (!open) {
      Speech.stop();
      setSpeaking(false);
    }
  }, [open]);

  useEffect(() => () => void Speech.stop(), []);

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/50" onPress={onClose}>
        {/* Swallow taps inside the sheet so only the backdrop closes it. */}
        <Pressable
          className="max-h-[80%] rounded-t-3xl bg-background px-5 pt-5"
          style={{ paddingBottom: insets.bottom + 20 }}
          onPress={() => {}}
        >
          <View className="mb-4 flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-primary-soft">
              <Icon as={Sun} weight="fill" size={22} className="text-primary-soft-foreground" />
            </View>
            <View className="flex-1">
              <Text className="font-medium">Your day</Text>
              <Text variant="muted">
                {thinking ? 'Onai is thinking…' : speaking ? 'Onai is talking…' : 'From Onai, on this hub'}
              </Text>
            </View>
            <Button variant="ghost" size="icon" testID="briefing-close" onPress={onClose}>
              <Icon as={X} size={22} />
            </Button>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {thinking ? (
              <View className="items-center gap-3 py-10">
                <MotiView
                  from={{ opacity: 0.35 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 700, loop: true, repeatReverse: true }}
                >
                  <Icon as={Sun} weight="fill" size={34} className="text-primary" />
                </MotiView>
                <Text variant="muted">Looking at your alarms, tasks and what's planned…</Text>
              </View>
            ) : text ? (
              <View className="gap-5">
                {/* Voice is how the answer arrives; the pulse says it's mid-sentence. */}
                <View className="items-center gap-3 py-4">
                  <MotiView
                    from={{ scale: speaking ? 0.9 : 1 }}
                    animate={{ scale: speaking ? 1.08 : 1 }}
                    transition={{ type: 'timing', duration: 650, loop: speaking, repeatReverse: true }}
                  >
                    <Pressable
                      testID="briefing-speak"
                      onPress={() => (speaking ? (Speech.stop(), setSpeaking(false)) : say(text))}
                      className="h-20 w-20 items-center justify-center rounded-full bg-primary"
                    >
                      <Icon
                        as={speaking ? SpeakerHigh : ArrowCounterClockwise}
                        weight="fill"
                        size={30}
                        className="text-primary-foreground"
                      />
                    </Pressable>
                  </MotiView>
                  <Text variant="muted">{speaking ? 'Tap to stop' : 'Tap to hear it again'}</Text>
                </View>

                <MarkdownText>{text}</MarkdownText>
              </View>
            ) : (
              <Text variant="muted" className="py-10 text-center">
                Nothing came back. Try again in a moment.
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
