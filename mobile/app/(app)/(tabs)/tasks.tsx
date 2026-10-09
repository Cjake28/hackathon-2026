import { router } from 'expo-router';
import { ListChecks, Plus, Trophy } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useHubTasks, usePoints, useSetTaskDone } from '@/hooks/useHub';
import { cn } from '@/lib/utils';
import type { HubTask } from '@/types';

type Filter = 'open' | 'mine' | 'done';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'To do' },
  { key: 'mine', label: 'Mine' },
  { key: 'done', label: 'Done' },
];

const STATUS_LABELS: Record<HubTask['status'], string> = {
  pending: 'Not done yet',
  redo: 'Needs another go',
  done: 'Done',
};

// Every task and chore in the house. Ticking the box is the whole interaction:
// the hub tells Mom and Dad straight away, and a finished chore is worth points.
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const can = useCan();
  const { data: me } = useMe();
  const canAssign = can('tasks.assign');

  const { data: tasks = [] } = useHubTasks(canAssign);
  const { data: points = [] } = usePoints();
  const setDone = useSetTaskDone();

  const [filter, setFilter] = useState<Filter>('open');

  const visible = useMemo(() => {
    const byNewest = (a: HubTask, b: HubTask) => b.createdAt.localeCompare(a.createdAt);
    switch (filter) {
      case 'mine':
        return tasks.filter((task) => task.assigneeId === me?.id).sort(byNewest);
      case 'done':
        return tasks.filter((task) => task.status === 'done').sort(byNewest);
      default:
        return tasks.filter((task) => task.status !== 'done').sort(byNewest);
    }
  }, [tasks, filter, me?.id]);

  const openCount = tasks.filter((task) => task.status !== 'done').length;
  const doneCount = tasks.filter((task) => task.status === 'done').length;

  // Only the assignee can tick a task off; a parent can undo one.
  const toggle = (task: HubTask) => {
    if (task.assigneeId !== me?.id && !canAssign) {
      Alert.alert('That task is for someone else.');
      return;
    }
    setDone.mutate({ id: task.id, done: task.status !== 'done' });
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Tasks</Text>
        <Pressable
          hitSlop={12}
          testID="task-new"
          onPress={() => {
            if (!canAssign) {
              Alert.alert('Only a parent can give out tasks.');
              return;
            }
            router.push('/task/new');
          }}
        >
          <Icon as={Plus} weight="regular" size={36} className="text-foreground" />
        </Pressable>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => String(item.id)}
        contentContainerClassName="gap-2 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <View className="flex-row justify-between">
              <Text variant="small" className={openCount > 0 ? 'text-warning' : 'text-muted-foreground'}>
                {openCount} still to do
              </Text>
              <Text variant="small" className="text-success">
                {doneCount} finished
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="-mx-4"
              contentContainerClassName="gap-2 px-4"
            >
              {FILTERS.map((item) => {
                const selected = item.key === filter;
                return (
                  <Button
                    key={item.key}
                    variant={selected ? 'default' : 'secondary'}
                    size="sm"
                    onPress={() => setFilter(item.key)}
                  >
                    <Text className={selected ? 'text-primary-foreground' : undefined} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </Button>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const done = item.status === 'done';
          return (
            <Card
              className={cn('w-full flex-row items-center gap-3 p-3', item.isChore && 'border-l-4 border-l-primary')}
            >
              <Checkbox testID={`task-check-${item.id}`} checked={done} onCheckedChange={() => toggle(item)} />
              <Pressable className="flex-1 flex-row items-center gap-3" onPress={() => router.push(`/task/${item.id}`)}>
                <FamilyAvatar member={{ id: item.assigneeId, name: item.assigneeName }} size={42} />
                <View className="flex-1 gap-0.5">
                  <Text className={cn('font-medium', done && 'text-muted-foreground line-through')} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text variant="muted" numberOfLines={1}>
                    {item.assigneeName} · {STATUS_LABELS[item.status]}
                  </Text>
                </View>
              </Pressable>
              {item.isChore ? (
                <Badge variant={done ? 'secondary' : 'outline'}>
                  <Text>10 pts</Text>
                </Badge>
              ) : null}
            </Card>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={ListChecks}
            title={filter === 'done' ? 'Nothing finished yet' : 'Nothing outstanding'}
            subtitle={'Say "Hey Jarvis, tell Ben to put the bins out" and it\'ll pop up on his phone.'}
          />
        }
        ListFooterComponent={
          points.length > 0 ? (
            <View className="gap-2 pt-6">
              <Text variant="label">Points</Text>
              <Card className="p-4">
                <CardList>
                  {points.map((row) => (
                    <View key={row.userId} className="flex-row items-center gap-3 py-2">
                      <FamilyAvatar member={{ id: row.userId, name: row.name }} size={36} />
                      <Text className="flex-1 font-medium" numberOfLines={1}>
                        {row.name}
                      </Text>
                      <Icon as={Trophy} weight="fill" size={14} className="text-accent-amber-base" />
                      <Text variant="small" className="text-muted-foreground">
                        {row.points} pts · {row.choresDone} chores
                      </Text>
                    </View>
                  ))}
                </CardList>
              </Card>
            </View>
          ) : null
        }
      />
    </View>
  );
}
