import { router } from 'expo-router';
import { ListChecks, Plus } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { STATUS_LABELS, useTasksStore } from '@/hooks/useTasks';
import { can } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import type { FamilyTask } from '@/types';

type Filter = 'open' | 'checking' | 'mine' | 'done';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'checking', label: 'To check' },
  { key: 'mine', label: 'Mine' },
  { key: 'done', label: 'Done' },
];

// Every task and chore in the house. "To check" is the queue a parent lives
// in — chores submitted with photos, waiting on a decision.
export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();
  const tasks = useTasksStore((state) => state.tasks);
  const [filter, setFilter] = useState<Filter>('open');

  const toCheck = tasks.filter((task) => task.status === 'submitted');

  const visible = useMemo(() => {
    const byNewest = (a: FamilyTask, b: FamilyTask) => b.createdAt.localeCompare(a.createdAt);
    switch (filter) {
      case 'checking':
        return [...toCheck].sort(byNewest);
      case 'mine':
        return tasks.filter((task) => task.assigneeId === speaker.id).sort(byNewest);
      case 'done':
        return tasks.filter((task) => task.status === 'approved').sort(byNewest);
      default:
        return tasks.filter((task) => task.status !== 'approved').sort(byNewest);
    }
  }, [tasks, toCheck, filter, speaker.id]);

  const canAssign = can(speaker.role, 'assignTasks');

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Tasks</Text>
        <Pressable
          hitSlop={12}
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
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <View className="flex-row justify-between">
              <Text variant="small" className={toCheck.length > 0 ? 'text-warning' : 'text-muted-foreground'}>
                {toCheck.length} waiting on a check
              </Text>
              <Text variant="small" className="text-success">
                {tasks.filter((task) => task.status === 'approved').length} done today
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4" contentContainerClassName="gap-2 px-4">
              {FILTERS.map((item) => {
                const selected = item.key === filter;
                const count = item.key === 'checking' ? toCheck.length : 0;
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
                    {count > 0 ? (
                      <Badge className={selected ? 'bg-card' : undefined}>
                        <Text className={selected ? 'text-foreground' : 'text-primary-foreground'}>{count}</Text>
                      </Badge>
                    ) : null}
                  </Button>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => {
          const assignee = members.find((member) => member.id === item.assigneeId);
          return (
            <Button variant="ghost" className="h-auto justify-start p-0" onPress={() => router.push(`/task/${item.id}`)}>
              <Card className={cn('w-full flex-row items-center gap-3 p-3', item.kind === 'chore' && 'border-l-4 border-l-primary')}>
                {assignee ? <FamilyAvatar member={assignee} size={46} /> : null}
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium" numberOfLines={1}>{item.title}</Text>
                  <Text variant="muted" numberOfLines={1}>{assignee?.name ?? 'Unassigned'} · {STATUS_LABELS[item.status]}</Text>
                </View>
                <Badge variant={item.status === 'submitted' ? 'secondary' : 'outline'}>
                  <Text>{item.points} pts</Text>
                </Badge>
              </Card>
            </Button>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={ListChecks}
            title={filter === 'checking' ? 'Nothing to check' : filter === 'done' ? 'Nothing finished yet' : 'Nothing outstanding'}
            subtitle={filter === 'checking' ? 'When someone finishes a chore, the before and after photos land here.' : 'Say "Hey Nova, tell Miguel to put the bins out" and it\'ll appear on his device.'}
          />
        }
      />
    </View>
  );
}
