import { useKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';
import { Alert, Modal, Pressable, Vibration, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useDevicePoll, useDismissAlarm, useSnoozeAlarm } from '@/hooks/useHub';
import { useLocationSharing } from '@/hooks/useLocationShare';
import { startAlarmSound, stopAlarmSound } from '@/lib/alarm-sound';
import { formatTime } from '@/lib/time';
import type { HubNotice } from '@/types';

// Mount once in the logged-in layout. Polls the hub every 3 s, pops up new tasks, finished chores and announcements,
// and covers the whole screen while one of my alarms rings, until Dismiss or Snooze.
export function HubListener() {
  const poll = useDevicePoll(showNotice);
  const dismiss = useDismissAlarm();
  const snooze = useSnoozeAlarm();
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
  );
}

// Ringing alarms don't need a notice: the poll's `ringing` drives the full-screen alarm above.
function showNotice(notice: HubNotice) {
  if (notice.kind === 'task:new') Alert.alert('New task', notice.text); // "Mom: Wash the dishes"
  if (notice.kind === 'task:reviewed') Alert.alert('Task done ✓', notice.text); // parents: "Ana finished: Wash the dishes"
  if (notice.kind === 'intercom') Alert.alert('📢 Announcement', notice.text); // "Announcement from Mom: dinner's ready"
  // Parents: a kid's alarm has rung for two minutes with nobody dismissing it.
  if (notice.kind === 'alarm:ignored') Alert.alert('⏰ Alarm still ringing', notice.text);
  // Fifteen minutes before anything in the calendar. The hub says it out loud too.
  if (notice.kind === 'event:soon') Alert.alert('📅 Coming up', notice.text);
}
