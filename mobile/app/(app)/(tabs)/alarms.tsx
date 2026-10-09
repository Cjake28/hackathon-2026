import { router } from 'expo-router';
import { Alarm, BellRinging, Microphone, Pill } from 'phosphor-react-native';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { describeDays, formatTime, sortAlarms, useAlarmsStore } from '@/hooks/useAlarms';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { useVoiceStore } from '@/hooks/useVoice';
import { can } from '@/lib/family-permissions';

// Every alarm and reminder, grouped by whose it is — these are the
// household's, not one phone's, and "what wakes Ana" is a real question.
export default function AlarmsScreen() {
  const insets = useSafeAreaInsets();
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();
  const alarms = useAlarmsStore((state) => state.alarms);
  const toggleAlarm = useAlarmsStore((state) => state.toggleAlarm);
  const wake = useVoiceStore((state) => state.wake);

  const owners = members.filter((member) => alarms.some((alarm) => alarm.ownerId === member.id));
  const activeCount = alarms.filter((alarm) => alarm.enabled).length;

  const mayToggle = (ownerId: string) => (ownerId === speaker.id ? can(speaker.role, 'ownAlarms') : can(speaker.role, 'othersAlarms'));

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Alarms</Text>
        <Button size="icon" onPress={() => { wake(); router.push('/talk'); }}>
          <Icon as={Microphone} weight="fill" className="text-primary-foreground" />
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4" contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <View className="flex-row justify-between">
          <Text variant="small" className="text-success">{activeCount} on</Text>
          <Text variant="small" className="text-muted-foreground">Dismissed by owner's voice only</Text>
        </View>

        {owners.length === 0 ? (
          <EmptyState icon={Alarm} title="No alarms yet" subtitle="Say “Hey Nova, wake Ana at 6:15 tomorrow” and it'll appear here." />
        ) : (
          owners.map((owner) => {
            const theirs = sortAlarms(alarms.filter((alarm) => alarm.ownerId === owner.id));
            return (
              <View key={owner.id} className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text variant="label">{owner.name}</Text>
                  <Text variant="muted">{theirs.length === 1 ? '1 set' : `${theirs.length} set`}</Text>
                </View>
                <View className="gap-2">
                  {theirs.map((alarm) => {
                    const setBy = members.find((member) => member.id === alarm.setById);
                    const escalateTo = members.find((member) => member.id === alarm.escalateToId);
                    const isReminder = alarm.kind === 'reminder';
                    return (
                      <Card key={alarm.id} className="gap-3 p-4">
                        <View className="flex-row items-center gap-3">
                          <Icon
                            as={isReminder ? Pill : Alarm}
                            weight={alarm.enabled ? 'fill' : 'regular'}
                            size={20}
                            className={alarm.enabled ? 'text-primary' : 'text-muted-foreground'}
                          />
                          <View className="flex-1 gap-0.5">
                            <Text variant="h3">{formatTime(alarm.time)}</Text>
                            <Text variant="muted" numberOfLines={1}>{alarm.label} · {describeDays(alarm.days)}</Text>
                          </View>
                          <Checkbox
                            checked={alarm.enabled}
                            onCheckedChange={() => {
                              if (!mayToggle(alarm.ownerId)) {
                                Alert.alert("Only a parent can change someone else's alarm.");
                                return;
                              }
                              toggleAlarm(alarm.id);
                            }}
                          />
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                          <Badge variant="secondary"><Text>{isReminder ? 'Reminder' : 'Wake-up'}</Text></Badge>
                          {setBy && setBy.id !== owner.id ? <Badge variant="outline"><Text>Set by {setBy.name}</Text></Badge> : null}
                          {escalateTo ? (
                            <Badge variant="outline">
                              <Icon as={BellRinging} weight="fill" size={12} />
                              <Text>Tells {escalateTo.name} after {alarm.escalateAfterMins} min</Text>
                            </Badge>
                          ) : null}
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-muted-foreground">
            Only the owner's voice turns their alarm off. Someone else saying "stop" does nothing.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
