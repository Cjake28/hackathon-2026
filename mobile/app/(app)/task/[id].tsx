import { router, useLocalSearchParams } from 'expo-router';
import { Check, ListChecks, Sparkle, Star, Trash, Trophy } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateTask, useDeleteTask, useHubFamily, useHubTasks, useSetTaskDone } from '@/hooks/useHub';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import type { HubTask } from '@/types';

const STATUS_LABELS: Record<HubTask['status'], string> = {
  pending: 'Not done yet',
  redo: 'Needs another go',
  done: 'Done',
};

// How long the task has to be finished — turned into a real time for the hub.
const DUE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: 'No deadline', hours: null },
  { label: 'Within the hour', hours: 1 },
  { label: 'Before dinner', hours: 6 },
  { label: 'Tonight', hours: 12 },
  { label: 'Tomorrow', hours: 24 },
];

function AssignTaskScreen() {
  const { data: people = [] } = useHubFamily();
  const create = useCreateTask();

  // Kids first: they're who a chore usually goes to.
  const assignable = [...people].sort((a, b) => (a.role === b.role ? 0 : a.role === 'child' ? -1 : 1));

  const [title, setTitle] = useState('');
  const [checklist, setChecklist] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [isChore, setIsChore] = useState(true);
  const [due, setDue] = useState(DUE_OPTIONS[2]);

  const chosen = assigneeId ?? assignable.find((p) => p.role === 'child')?.id ?? assignable[0]?.id;
  const assignee = assignable.find((person) => person.id === chosen);
  const ready = title.trim().length > 0 && chosen !== undefined;

  const give = () => {
    if (!ready || chosen === undefined) return;
    create.mutate(
      {
        title: title.trim(),
        assigneeId: chosen,
        isChore,
        // One line each: what "done" looks like.
        checklist: checklist
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
        dueAt: due.hours ? new Date(Date.now() + due.hours * 3_600_000).toISOString() : undefined,
      },
      { onSuccess: () => router.replace('/(app)/(tabs)/tasks') },
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Give out a task" back />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-6" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text variant="label">Who's doing it</Text>
          <View className="flex-row flex-wrap gap-2">
            {assignable.map((person) => {
              const selected = person.id === chosen;
              return (
                <Pressable
                  key={person.id}
                  testID={`task-assignee-${person.id}`}
                  onPress={() => setAssigneeId(person.id)}
                  className={cn('w-[68px] items-center gap-1 rounded-md py-2', selected && 'bg-primary-soft')}
                >
                  <FamilyAvatar member={person} size={56} />
                  <Text className="text-xs" numberOfLines={1}>
                    {person.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text variant="label">What they have to do</Text>
          <Input
            testID="task-title"
            value={title}
            onChangeText={setTitle}
            placeholder="Wash up after dinner"
            returnKeyType="next"
          />
        </View>

        <View className="gap-2">
          <Text variant="label">What finished looks like</Text>
          <Text variant="small" className="text-muted-foreground">
            One thing per line. They'll see this list when they open the task.
          </Text>
          <Input
            testID="task-checklist"
            value={checklist}
            onChangeText={setChecklist}
            placeholder={'Sink clear\nCounters wiped\nBin out'}
            multiline
            className="min-h-24 pt-3"
          />
        </View>

        <View className="gap-2">
          <Text variant="label">Does it earn points?</Text>
          <Pressable
            testID="task-kind-chore"
            onPress={() => setIsChore(true)}
            className={cn('flex-row items-start gap-3 rounded-md bg-sunken p-3', isChore && 'bg-primary-soft')}
          >
            <Icon
              as={Star}
              weight={isChore ? 'fill' : 'regular'}
              size={20}
              className={isChore ? 'text-primary' : 'text-muted-foreground'}
            />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">A chore — worth 10 points</Text>
              <Text variant="small" className="text-muted-foreground">
                Counts towards the family leaderboard when they finish it.
              </Text>
            </View>
          </Pressable>
          <Pressable
            testID="task-kind-task"
            onPress={() => setIsChore(false)}
            className={cn('flex-row items-start gap-3 rounded-md bg-sunken p-3', !isChore && 'bg-primary-soft')}
          >
            <Icon
              as={ListChecks}
              weight={!isChore ? 'fill' : 'regular'}
              size={20}
              className={!isChore ? 'text-primary' : 'text-muted-foreground'}
            />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Just a task</Text>
              <Text variant="small" className="text-muted-foreground">
                Done when they tick it off. No points.
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text variant="label">By when</Text>
          <View className="flex-row flex-wrap gap-2">
            {DUE_OPTIONS.map((option) => (
              <Button
                key={option.label}
                variant={due.label === option.label ? 'default' : 'secondary'}
                size="sm"
                onPress={() => setDue(option)}
              >
                <Text className={due.label === option.label ? 'text-primary-foreground' : undefined}>
                  {option.label}
                </Text>
              </Button>
            ))}
          </View>
        </View>

        <Button testID="task-send" disabled={!ready || create.isPending} onPress={give}>
          <Text className="text-primary-foreground">{assignee ? `Send to ${assignee.name}` : 'Send'}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}

function TaskDetailScreen({ id }: { id: number }) {
  const can = useCan();
  const { data: me } = useMe();
  const canAssign = can('tasks.assign');

  const { data: tasks = [], isPending } = useHubTasks(canAssign);
  const setDone = useSetTaskDone();
  const remove = useDeleteTask();

  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Task" back />
        {isPending ? null : (
          <>
            <EmptyState icon={ListChecks} title="This task is gone" subtitle="It may have been finished or removed." />
            <View className="items-center">
              <Button variant="secondary" onPress={() => router.replace('/(app)/(tabs)/tasks')}>
                <Text>Back to tasks</Text>
              </Button>
            </View>
          </>
        )}
      </View>
    );
  }

  const done = task.status === 'done';
  const isMine = task.assigneeId === me?.id;

  const confirmRemove = () =>
    Alert.alert(task.title, 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => remove.mutate(task.id, { onSuccess: () => router.back() }),
      },
    ]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={task.isChore ? 'Chore' : 'Task'}
        subtitle={STATUS_LABELS[task.status]}
        back
        right={
          canAssign ? (
            <Button variant="ghost" size="icon" testID="task-delete" onPress={confirmRemove}>
              <Icon as={Trash} />
            </Button>
          ) : undefined
        }
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-6">
        <Card className="gap-3 p-6">
          <Text variant="h3">{task.title}</Text>

          <View className="flex-row items-center gap-3 pt-1">
            <FamilyAvatar member={{ id: task.assigneeId, name: task.assigneeName }} size={48} />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium" numberOfLines={1}>
                {task.assigneeName}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                Given {relativeTime(task.createdAt)} ago
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between pt-1">
            <Text variant="small" className="text-muted-foreground">
              {task.dueAt ? `Due ${new Date(task.dueAt).toLocaleString()}` : 'No deadline'}
            </Text>
            {task.isChore ? (
              <Text variant="small" className="text-muted-foreground">
                10 points
              </Text>
            ) : null}
          </View>
        </Card>

        {task.checklist.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">What finished looks like</Text>
            <Card className="p-4">
              <CardList>
                {task.checklist.map((line) => (
                  <View key={line} className="flex-row items-start gap-2 py-2">
                    <Icon as={Check} weight="bold" size={16} className="mt-1 text-primary" />
                    <Text className="flex-1">{line}</Text>
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        ) : null}

        {task.feedback ? (
          <View className="gap-2">
            <Text variant="label">What Onai said</Text>
            <Card className="flex-row items-start gap-3 bg-accent-rose-soft p-4">
              <Icon as={Sparkle} weight="fill" size={20} className="text-accent-rose-onSoft" />
              <Text className="flex-1 text-accent-rose-onSoft">{task.feedback}</Text>
            </Card>
          </View>
        ) : null}

        {done ? (
          <Card className="items-center gap-3 bg-accent-teal-soft py-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-card">
              <Icon as={Trophy} weight="fill" size={32} className="text-accent-teal-onSoft" />
            </View>
            <Text variant="h3" className="text-accent-teal-onSoft">
              Nice work!
            </Text>
            {task.isChore ? (
              <Badge className="bg-card">
                <Icon as={Star} weight="fill" size={12} className="text-accent-teal-onSoft" />
                <Text className="text-accent-teal-onSoft">+10 points</Text>
              </Badge>
            ) : null}
            {task.doneAt ? (
              <Text variant="small" className="text-accent-teal-onSoft">
                Finished {relativeTime(task.doneAt)} ago
              </Text>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>

      {/* Ticking it off tells Mom and Dad straight away. No photo, no check. */}
      {isMine || canAssign ? (
        <View className="border-t border-border p-4">
          <Button
            testID="task-toggle"
            variant={done ? 'secondary' : 'default'}
            disabled={setDone.isPending}
            onPress={() => setDone.mutate({ id: task.id, done: !done })}
          >
            <Text className={done ? undefined : 'text-primary-foreground'}>
              {done ? 'Not done after all' : "I've finished it"}
            </Text>
          </Button>
        </View>
      ) : null}
    </View>
  );
}

// One route serves both view and create, keyed on the literal id "new".
export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'new') return <AssignTaskScreen />;
  return <TaskDetailScreen id={Number(id)} />;
}
