import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Modal, Pressable, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useDevicePoll, useDismissAlarm, useSnoozeAlarm } from '@/hooks/useHub';
import { useLocationSharing } from '@/hooks/useLocationShare';
import { playNoticeSound, startAlarmSound, stopAlarmSound } from '@/lib/alarm-sound';
import { formatTime } from '@/lib/time';
import type { HubNotice } from '@/types';

// Ringing alarms don't need a notice: the poll's `ringing` drives the full-screen alarm below.
const NOTICE_TITLES: Partial<Record<HubNotice['kind'], string>> = {
  'task:new': 'New task', // "Mom: Wash the dishes"
  'task:reviewed': 'Task done ✓', // parents: "Ana finished: Wash the dishes"
  intercom: '📢 Announcement', // "Announcement from Mom: dinner's ready"
  // Parents: a kid's alarm has rung for two minutes with nobody dismissing it.
  'alarm:ignored': '⏰ Alarm still ringing',
  // Fifteen minutes before anything in the calendar. The hub says it out loud too.
  'event:soon': '📅 Coming up',
};

// Mount once in the logged-in layout. Polls the hub every 3 s, slides up new tasks, finished chores and
// announcements as a bottom sheet (with one ring of the alarm sound), and covers the whole screen while
// one of my alarms rings, until Dismiss or Snooze.
export function HubListener() {
  const [notice, setNotice] = useState<{ title: string; text: string } | null>(null);
  const poll = useDevicePoll((incoming) => {
    const title = NOTICE_TITLES[incoming.kind];
    if (!title) return;
    playNoticeSound();
    setNotice({ title, text: incoming.text });
  });
  const dismiss = useDismissAlarm();
  const snooze = useSnoozeAlarm();
  const insets = useSafeAreaInsets();
  const alarm = poll.data?.ringing[0];

  // The screen stays on, so a ringing alarm can't be missed on stage.
  useKeepAwake();

  // Sends this phone's position to the hub while "Share where I am" is on (Settings).
  useLocationSharing();

  // Buzz and ring until it's dismissed. A silent phone would lose the alarm on stage, so the
  // sound loops rather than playing once.
  useEffect(() => {
    if (!alarm) return;
    Vibration.vibrate([0, 800, 600], true);
    startAlarmSound();
    return () => {
      Vibration.cancel();
      stopAlarmSound();
    };
  }, [alarm?.id]);

  return (
    <>
      {/* Notices: a sheet that slides up from the bottom, not a centered dialog. */}
      <Modal
        visible={!!notice && !alarm}
        transparent
        animationType="slide"
        onRequestClose={() => setNotice(null)}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={() => setNotice(null)}>
          <Pressable
            className="gap-3 rounded-t-3xl bg-background px-6 pt-4"
            style={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}
            onPress={() => {}}
          >
            <View className="h-1.5 w-12 self-center rounded-full bg-border" />
            <Text variant="h4">{notice?.title}</Text>
            <Text variant="large" className="text-muted-foreground">
              {notice?.text}
            </Text>
            <Button testID="notice-ok" onPress={() => setNotice(null)}>
              <Text className="text-primary-foreground">Got it</Text>
            </Button>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!alarm} animationType="fade" onRequestClose={() => {}}>
        <View className="flex-1 items-center justify-center gap-6 bg-primary p-8">
          <Text className="text-6xl">⏰</Text>
          <Text variant="h3" className="text-center text-primary-foreground">
            {alarm?.label}
          </Text>
          <Text variant="large" className="text-primary-foreground">
            {alarm ? formatTime(alarm.time) : ''}
          </Text>
          <Pressable
            testID="alarm-dismiss"
            disabled={dismiss.isPending}
            onPress={() => alarm && dismiss.mutate(alarm.id)}
            className="w-full rounded-3xl bg-background p-5"
          >
            <Text variant="large" className="text-center">
              Dismiss
            </Text>
          </Pressable>
          <Pressable
            testID="alarm-snooze"
            disabled={snooze.isPending}
            onPress={() => alarm && snooze.mutate(alarm.id)}
            className="w-full rounded-3xl border-2 border-primary-foreground p-5"
          >
            <Text variant="large" className="text-center text-primary-foreground">
              Snooze 5 min
            </Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}
