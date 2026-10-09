import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ListChecks, Star, Trash, Trophy, Warning } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ROOMS, useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { STATUS_LABELS, useTasksStore } from '@/hooks/useTasks';
import { can } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import type { TaskKind } from '@/types';

const DUE_OPTIONS = ['Now', 'Before dinner', 'Before screen time', 'Tonight', 'Tomorrow'];

function AssignTaskScreen() {
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();
  const assign = useTasksStore((state) => state.assign);

  const assignable = [...members].sort((a, b) => (a.role === b.role ? 0 : a.role === 'child' ? -1 : 1));

  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [assigneeId, setAssigneeId] = useState(assignable.find((m) => m.role === 'child')?.id ?? assignable[0]?.id);
  const [kind, setKind] = useState<TaskKind>('chore');
  const [due, setDue] = useState('Before dinner');
  const [room, setRoom] = useState<string | undefined>();

  const assignee = members.find((member) => member.id === assigneeId);
  const ready = title.trim().length > 0 && Boolean(assigneeId);

  const give = () => {
    if (!ready || !assigneeId) return;
    const id = assign({ title, detail, kind, assigneeId, assignedById: speaker.id, due, room });
    router.replace(`/task/${id}`);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Give out a task" back />
      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-6" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text variant="label">Who's doing it</Text>
          <View className="flex-row flex-wrap gap-2">
            {assignable.map((member) => {
              const selected = member.id === assigneeId;
              return (
                <Pressable key={member.id} onPress={() => setAssigneeId(member.id)} className={cn('w-[68px] items-center gap-1 rounded-md py-2', selected && 'bg-primary-soft')}>
                  <FamilyAvatar member={member} size={56} />
                  <Text className="text-xs" numberOfLines={1}>{member.name}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text variant="label">What they have to do</Text>
          <Input value={title} onChangeText={setTitle} placeholder="Wash up after dinner" returnKeyType="next" />
        </View>

        <View className="gap-2">
          <Text variant="label">What finished looks like</Text>
          <Text variant="small" className="text-muted-foreground">
            Be specific. This is what the camera check compares against.
          </Text>
          <Input value={detail} onChangeText={setDetail} placeholder="Sink clear, counters wiped, bin out." multiline className="min-h-20 pt-3" />
        </View>

        <View className="gap-2">
          <Text variant="label">How it's checked</Text>
          <Pressable onPress={() => setKind('chore')} className={cn('flex-row items-start gap-3 rounded-md bg-sunken p-3', kind === 'chore' && 'bg-primary-soft')}>
            <Icon as={Camera} weight={kind === 'chore' ? 'fill' : 'regular'} size={20} className={kind === 'chore' ? 'text-primary' : 'text-muted-foreground'} />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">Camera check</Text>
              <Text variant="small" className="text-muted-foreground">Before and after photos, compared on the hub.</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setKind('task')} className={cn('flex-row items-start gap-3 rounded-md bg-sunken p-3', kind === 'task' && 'bg-primary-soft')}>
            <Icon as={ListChecks} weight={kind === 'task' ? 'fill' : 'regular'} size={20} className={kind === 'task' ? 'text-primary' : 'text-muted-foreground'} />
            <View className="flex-1 gap-0.5">
              <Text className="font-medium">They just say so</Text>
              <Text variant="small" className="text-muted-foreground">Done when they mark it done. No photos.</Text>
            </View>
          </Pressable>
        </View>

        <View className="gap-2">
          <Text variant="label">By when</Text>
          <View className="flex-row flex-wrap gap-2">
            {DUE_OPTIONS.map((option) => (
              <Button key={option} variant={due === option ? 'default' : 'secondary'} size="sm" onPress={() => setDue(option)}>
                <Text className={due === option ? 'text-primary-foreground' : undefined}>{option}</Text>
              </Button>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text variant="label">Which room</Text>
          <View className="flex-row flex-wrap gap-2">
            {ROOMS.map((option) => (
              <Button key={option} variant={room === option ? 'default' : 'secondary'} size="sm" onPress={() => setRoom((current) => (current === option ? undefined : option))}>
                <Text className={room === option ? 'text-primary-foreground' : undefined}>{option}</Text>
              </Button>
            ))}
          </View>
        </View>

        <Button disabled={!ready} onPress={give}>
          <Text className="text-primary-foreground">{assignee ? `Send to ${assignee.name}` : 'Send'}</Text>
        </Button>
      </ScrollView>
    </View>
  );
}

function TaskDetailScreen({ id }: { id: string }) {
  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();

  const tasks = useTasksStore((state) => state.tasks);
  const checking = useTasksStore((state) => state.checking);
  const start = useTasksStore((state) => state.start);
  const submit = useTasksStore((state) => state.submit);
  const review = useTasksStore((state) => state.review);
  const approveManually = useTasksStore((state) => state.approveManually);
  const remove = useTasksStore((state) => state.remove);

  const task = tasks.find((item) => item.id === id);

  if (!task) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Task" back />
        <EmptyState icon={ListChecks} title="This task is gone" subtitle="It may have been finished or removed." />
        <View className="items-center">
          <Button variant="secondary" onPress={() => router.replace('/(app)/(tabs)/tasks')}><Text>Back to tasks</Text></Button>
        </View>
      </View>
    );
  }

  const assignee = members.find((member) => member.id === task.assigneeId);
  const assigner = members.find((member) => member.id === task.assignedById);
  const isChecking = checking.includes(task.id);
  const isMine = task.assigneeId === speaker.id;
  const canReview = can(speaker.role, 'reviewChores');

  const confirmRemove = () => {
    Alert.alert(task.title, 'Remove this task?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { remove(task.id); router.back(); } },
    ]);
  };

  const footer = () => {
    if (isChecking) return <Button disabled><Text>Checking the photos…</Text></Button>;

    if (task.status === 'submitted' && canReview) {
      return (
        <View className="flex-row gap-3">
          <Button variant="secondary" className="flex-1" onPress={() => approveManually(task.id)}>
            <Text>Pass it anyway</Text>
          </Button>
          <Button className="flex-[1.4]" onPress={() => review(task.id)}>
            <Icon as={Camera} weight="fill" size={20} className="text-primary-foreground" />
            <Text className="text-primary-foreground">Check the photos</Text>
          </Button>
        </View>
      );
    }

    if (!isMine) return null;

    if (task.status === 'assigned') {
      return <Button onPress={() => start(task.id)}><Text className="text-primary-foreground">{task.kind === 'chore' ? 'Start — take the before photo' : 'Start'}</Text></Button>;
    }

    if (task.status === 'doing' || task.status === 'rejected') {
      return <Button onPress={() => submit(task.id)}><Text className="text-primary-foreground">{task.kind === 'chore' ? "I've finished — take the after photo" : 'Mark as done'}</Text></Button>;
    }

    return null;
  };

  const action = footer();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={task.kind === 'chore' ? 'Chore' : 'Task'}
        subtitle={STATUS_LABELS[task.status]}
        back
        right={can(speaker.role, 'assignTasks') ? (
          <Button variant="ghost" size="icon" onPress={confirmRemove}><Icon as={Trash} /></Button>
        ) : undefined}
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-6">
        <Card className="gap-3 p-6">
          <Text variant="h3">{task.title}</Text>
          {task.detail ? <Text variant="muted">{task.detail}</Text> : null}

          <View className="flex-row items-center gap-3 pt-1">
            {assignee ? <FamilyAvatar member={assignee} size={48} /> : null}
            <View className="flex-1 gap-0.5">
              <Text className="font-medium" numberOfLines={1}>{assignee?.name ?? 'Unassigned'}</Text>
              <Text variant="muted" numberOfLines={1}>Given by {assigner?.name ?? 'someone'}</Text>
            </View>
          </View>

          <View className="flex-row justify-between pt-1">
            <Text variant="small" className="text-muted-foreground">Due: {task.due ?? 'No deadline'}</Text>
            <Text variant="small" className="text-muted-foreground">{task.points} points</Text>
            {task.room ? <Text variant="small" className="text-muted-foreground">{task.room}</Text> : null}
          </View>
        </Card>

        {task.kind === 'chore' ? (
          <View className="gap-2">
            <Text variant="label">Camera check</Text>
            <Text variant="muted">Before and after, compared on the hub</Text>
            <View className="flex-row gap-3">
              <View className="flex-1 gap-1">
                <Text variant="small" className="text-muted-foreground">Before</Text>
                {task.beforePhoto ? (
                  <Image source={{ uri: task.beforePhoto }} className="h-32 w-full rounded-md" />
                ) : (
                  <View className="h-32 items-center justify-center rounded-md bg-sunken"><Text variant="muted">Not taken</Text></View>
                )}
              </View>
              <View className="flex-1 gap-1">
                <Text variant="small" className="text-muted-foreground">After</Text>
                {isChecking ? (
                  <View className="h-32 items-center justify-center rounded-md bg-sunken"><Text variant="muted">Scanning…</Text></View>
                ) : task.afterPhoto ? (
                  <Image source={{ uri: task.afterPhoto }} className="h-32 w-full rounded-md" />
                ) : (
                  <View className="h-32 items-center justify-center rounded-md bg-sunken"><Text variant="muted">Not taken</Text></View>
                )}
              </View>
            </View>
          </View>
        ) : null}

        {task.status === 'approved' ? (
          <Card className="items-center gap-3 bg-accent-teal-soft py-8">
            <View className="h-16 w-16 items-center justify-center rounded-full bg-card">
              <Icon as={Trophy} weight="fill" size={32} className="text-accent-teal-onSoft" />
            </View>
            <Text variant="h3" className="text-accent-teal-onSoft">Nice work!</Text>
            <Badge className="bg-card">
              <Icon as={Star} weight="fill" size={12} className="text-accent-teal-onSoft" />
              <Text className="text-accent-teal-onSoft">+{task.points} points</Text>
            </Badge>
            {task.feedback ? (
              <Text variant="small" className="max-w-xs text-center text-accent-teal-onSoft">{task.feedback}</Text>
            ) : null}
          </Card>
        ) : task.feedback ? (
          <View className="gap-2">
            <Text variant="label">What the check found</Text>
            <Card className="flex-row items-start gap-3 bg-accent-rose-soft p-4">
              <Icon as={Warning} weight="fill" size={20} className="text-accent-rose-onSoft" />
              <Text className="flex-1 text-accent-rose-onSoft">{task.feedback}</Text>
            </Card>
          </View>
        ) : null}
      </ScrollView>

      {action ? <View className="border-t border-border p-4">{action}</View> : null}
    </View>
  );
}

// One route serves both view and create, keyed on the literal id "new" —
// matches Nova's task/[id] pattern.
export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id === 'new') return <AssignTaskScreen />;
  return <TaskDetailScreen id={id} />;
}
