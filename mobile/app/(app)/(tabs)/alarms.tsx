import { router } from 'expo-router';
import { Alarm, Microphone, Pill, Plus, Trash } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateAlarm, useDeleteAlarm, useHubAlarms, useHubFamily, useUpdateAlarm } from '@/hooks/useHub';
import { describeRepeat, formatTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { HubAlarm } from '@/types';

const REPEATS: HubAlarm['repeat'][] = ['once', 'daily', 'weekdays'];

// Every alarm and reminder the hub rings, grouped by whose it is — these are the
// household's, not one phone's, and "what wakes Ana" is a real question.
// A parent sees everyone's; everyone else sees their own.
export default function AlarmsScreen() {
  const insets = useSafeAreaInsets();
  const can = useCan();
  const { data: me } = useMe();
  const family = can('alarms.family');

  const { data: alarms = [] } = useHubAlarms(family ? { all: true } : {});
  const { data: people = [] } = useHubFamily();
  const update = useUpdateAlarm();
  const remove = useDeleteAlarm();

  const [adding, setAdding] = useState(false);

  const nameOf = (userId: number) =>
    userId === me?.id ? 'You' : (people.find((p) => p.id === userId)?.name ?? 'Someone');

  // One group per owner, so "what wakes Ana" is one place to look.
  const groups = useMemo(() => {
    const ids = [...new Set(alarms.map((a) => a.userId))].sort((a, b) => a - b);
    return ids.map((userId) => ({
      userId,
      theirs: alarms.filter((a) => a.userId === userId),
    }));
  }, [alarms]);

  const activeCount = alarms.filter((a) => a.enabled).length;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Alarms</Text>
        <View className="flex-row items-center gap-1">
          <Button variant="ghost" size="icon" testID="alarm-add" onPress={() => setAdding((on) => !on)}>
            <Icon as={Plus} size={28} />
          </Button>
          <Button size="icon" onPress={() => router.push('/talk')}>
            <Icon as={Microphone} weight="fill" className="text-primary-foreground" />
          </Button>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row justify-between">
          <Text variant="small" className="text-success">
            {activeCount} on
          </Text>
          <Text variant="small" className="text-muted-foreground">
            Rings on the phone it belongs to
          </Text>
        </View>

        {adding ? <NewAlarm onDone={() => setAdding(false)} /> : null}

        {groups.length === 0 ? (
          <EmptyState
            icon={Alarm}
            title="No alarms yet"
            subtitle={'Say "Hey Onai, wake Ana at 6:15 tomorrow" and it\'ll appear here.'}
          />
        ) : (
          groups.map((group) => (
            <View key={group.userId} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="label">{nameOf(group.userId)}</Text>
                <Text variant="muted">{group.theirs.length === 1 ? '1 set' : `${group.theirs.length} set`}</Text>
              </View>
              <View className="gap-2">
                {group.theirs.map((alarm) => {
                  const isReminder = alarm.kind === 'reminder';
                  const setByElse = alarm.createdById !== alarm.userId;
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
                          <Text variant="muted" numberOfLines={1}>
                            {alarm.label} · {describeRepeat(alarm.repeat)}
                          </Text>
                        </View>
                        {/* The hub refuses when a child touches an alarm a parent set, and shows its own alert. */}
                        <Checkbox
                          testID={`alarm-toggle-${alarm.id}`}
                          checked={alarm.enabled}
                          onCheckedChange={(next) => update.mutate({ id: alarm.id, enabled: next })}
                        />
                      </View>
                      <View className="flex-row flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          <Text>{isReminder ? 'Reminder' : 'Wake-up'}</Text>
                        </Badge>
                        {setByElse ? (
                          <Badge variant="outline">
                            <Text>Set by {nameOf(alarm.createdById)}</Text>
                          </Badge>
                        ) : null}
                        <View className="flex-1" />
                        <Pressable
                          testID={`alarm-delete-${alarm.id}`}
                          hitSlop={10}
                          onPress={() => remove.mutate(alarm.id)}
                        >
                          <Icon as={Trash} size={18} className="text-destructive" />
                        </Pressable>
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-muted-foreground">
            An alarm rings full screen on the phone it was set for. Whoever it belongs to can always snooze or stop it.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}

// Add an alarm. A parent can set one for anyone; everyone else only for themselves.
function NewAlarm({ onDone }: { onDone: () => void }) {
  const can = useCan();
  const { data: me } = useMe();
  const { data: people = [] } = useHubFamily();
  const create = useCreateAlarm();

  const [label, setLabel] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<HubAlarm['repeat']>('once');
  const [userId, setUserId] = useState<number | undefined>(undefined);

  const forAnyone = can('alarms.family');
  const valid = /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

  const save = () => {
    if (!valid) return;
    create.mutate(
      { userId: forAnyone ? (userId ?? me?.id) : undefined, label: label.trim() || undefined, time, repeat },
      { onSuccess: onDone },
    );
  };

  return (
    <Card className="gap-3 p-4">
      <Text variant="label">New alarm</Text>

      {forAnyone && people.length > 0 ? (
        <View className="gap-1.5">
          <Text variant="small" className="text-muted-foreground">
            Who it rings for
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {people.map((person) => {
              const on = (userId ?? me?.id) === person.id;
              return (
                <Button
                  key={person.id}
                  testID={`alarm-for-${person.id}`}
                  variant={on ? 'default' : 'secondary'}
                  size="sm"
                  onPress={() => setUserId(person.id)}
                >
                  <Text className={cn(on && 'text-primary-foreground')}>{person.name}</Text>
                </Button>
              );
            })}
          </View>
        </View>
      ) : null}

      <Input testID="alarm-label" placeholder="What it's for (e.g. School)" value={label} onChangeText={setLabel} />
      <Input
        testID="alarm-time"
        placeholder="Time, 24-hour (e.g. 06:15)"
        keyboardType="numbers-and-punctuation"
        value={time}
        onChangeText={setTime}
      />

      <View className="flex-row flex-wrap gap-2">
        {REPEATS.map((option) => (
          <Button
            key={option}
            variant={repeat === option ? 'default' : 'secondary'}
            size="sm"
            onPress={() => setRepeat(option)}
          >
            <Text className={cn(repeat === option && 'text-primary-foreground')}>{describeRepeat(option)}</Text>
          </Button>
        ))}
      </View>

      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={onDone}>
          <Text>Cancel</Text>
        </Button>
        <Button testID="alarm-save" className="flex-1" disabled={!valid || create.isPending} onPress={save}>
          <Text className="text-primary-foreground">Set it</Text>
        </Button>
      </View>
    </Card>
  );
}
