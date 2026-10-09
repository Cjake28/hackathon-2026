import { router, useLocalSearchParams } from 'expo-router';
import { Alarm, Check, ListChecks, Trophy, UserCircle } from 'phosphor-react-native';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useHubAlarms, useHubFamily, useHubTasks, usePoints } from '@/hooks/useHub';
import { describeRepeat, formatTime, relativeTime } from '@/lib/time';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  parent: 'Parent',
  child: 'Child',
  guest: 'Guest',
};

// One person as the hub knows them: in or out, what they still have to do, and
// what wakes them up. A parent sees their alarms and tasks; everyone else sees
// only whether they're home.
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);
  const can = useCan();

  const { data: people = [], isPending } = useHubFamily();
  const { data: points = [] } = usePoints();
  const { data: tasks = [] } = useHubTasks(can('tasks.assign'));
  const { data: alarms = [] } = useHubAlarms(can('alarms.family') ? { userId } : {});

  const person = people.find((item) => item.id === userId);

  if (!person) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Person" back />
        {isPending ? null : (
          <>
            <EmptyState
              icon={UserCircle}
              title="Nobody here"
              subtitle="This person may have been removed from the household."
            />
            <View className="items-center">
              <Button variant="secondary" onPress={() => router.replace('/(app)/(tabs)/family')}>
                <Text>Back to family</Text>
              </Button>
            </View>
          </>
        )}
      </View>
    );
  }

  const score = points.find((row) => row.userId === person.id);
  const theirs = tasks.filter((task) => task.assigneeId === person.id);
  const open = theirs.filter((task) => task.status !== 'done');
  const theirAlarms = can('alarms.family') ? alarms.filter((alarm) => alarm.userId === person.id) : [];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={person.name} subtitle={ROLE_LABELS[person.role] ?? person.role} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="items-center gap-3 py-8">
          <FamilyAvatar member={person} size={92} />
          <Text variant="h3">{person.name}</Text>
          <Badge variant={person.isHome ? 'secondary' : 'outline'}>
            <Text>
              {person.isHome
                ? 'Home now'
                : person.lastSeenAt
                  ? `Out · last home ${relativeTime(person.lastSeenAt)} ago`
                  : 'Out'}
            </Text>
          </Badge>

          <View className="w-full flex-row justify-around px-6 pt-2">
            <View className="items-center">
              <Text variant="large">{score?.points ?? 0}</Text>
              <Text variant="muted">points</Text>
            </View>
            <View className="items-center">
              <Text variant="large">{score?.choresDone ?? 0}</Text>
              <Text variant="muted">chores done</Text>
            </View>
            <View className="items-center">
              <Text variant="large">{open.length}</Text>
              <Text variant="muted">still to do</Text>
            </View>
          </View>
        </Card>

        {can('tasks.assign') ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="label">Still to do</Text>
              <Button variant="ghost" size="sm" onPress={() => router.push('/task/new')}>
                <Text>Give a task</Text>
              </Button>
            </View>
            {open.length === 0 ? (
              <Card className="bg-sunken p-6">
                <Text variant="muted" className="text-center">
                  Nothing outstanding. They're clear.
                </Text>
              </Card>
            ) : (
              <Card className="p-4">
                <CardList>
                  {open.map((task) => (
                    <View key={task.id} className="flex-row items-center gap-3 py-2.5">
                      <Icon
                        as={task.isChore ? Trophy : ListChecks}
                        weight="regular"
                        size={20}
                        className="text-muted-foreground"
                      />
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium" numberOfLines={1}>
                          {task.title}
                        </Text>
                        <Text variant="muted" numberOfLines={1}>
                          {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleString()}` : 'No deadline'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </CardList>
              </Card>
            )}
          </View>
        ) : null}

        {can('alarms.family') ? (
          <View className="gap-2">
            <Text variant="label">What wakes them</Text>
            {theirAlarms.length === 0 ? (
              <Card className="bg-sunken p-6">
                <Text variant="muted" className="text-center">
                  No alarms set for {person.name}.
                </Text>
              </Card>
            ) : (
              <Card className="p-4">
                <CardList>
                  {theirAlarms.map((alarm) => (
                    <View key={alarm.id} className="flex-row items-center gap-3 py-2.5">
                      <Icon
                        as={Alarm}
                        weight={alarm.enabled ? 'fill' : 'regular'}
                        size={20}
                        className={alarm.enabled ? 'text-primary' : 'text-muted-foreground'}
                      />
                      <View className="flex-1 gap-0.5">
                        <Text className="font-medium">
                          {formatTime(alarm.time)} · {alarm.label}
                        </Text>
                        <Text variant="muted">{describeRepeat(alarm.repeat)}</Text>
                      </View>
                      {alarm.enabled ? <Icon as={Check} weight="bold" size={16} className="text-primary" /> : null}
                    </View>
                  ))}
                </CardList>
              </Card>
            )}
          </View>
        ) : null}

        {can('users.manage') ? (
          <Button variant="secondary" testID="member-accounts" onPress={() => router.push('/accounts')}>
            <Text>Change their login or role</Text>
          </Button>
        ) : null}
      </ScrollView>
    </View>
  );
}
