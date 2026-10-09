import { router, useLocalSearchParams } from 'expo-router';
import { Check, Microphone, ScanSmiley } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { useTasksStore } from '@/hooks/useTasks';
import { CAPABILITY_LABELS, can, capabilitiesFor, ROLE_BLURBS, ROLE_LABELS } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import type { Role } from '@/types';

const ROLES: Role[] = ['parent', 'child', 'guest'];

// One person: what the hub recognises about them, and what they're allowed to
// do. The capability list renders from `capabilitiesFor(role)` so it can never
// drift from what the hub actually enforces.
export default function MemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const members = useFamilyStore((state) => state.members);
  const setRole = useFamilyStore((state) => state.setRole);
  const setHome = useFamilyStore((state) => state.setHome);
  const setRecognition = useFamilyStore((state) => state.setRecognition);
  const speaker = useSpeaker();
  const tasks = useTasksStore((state) => state.tasks);

  const member = members.find((item) => item.id === id);

  if (!member) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Person" back />
        <EmptyState icon={Check} title="Nobody here" subtitle="This person may have been removed from the household." />
        <View className="items-center">
          <Button variant="secondary" onPress={() => router.replace('/(app)/(tabs)/family')}>
            <Text>Back to family</Text>
          </Button>
        </View>
      </View>
    );
  }

  const canAdmin = can(speaker.role, 'hubAdmin');
  const theirTasks = tasks.filter((task) => task.assigneeId === member.id && task.status !== 'approved');

  const changeRole = (role: Role) => {
    if (!canAdmin) {
      Alert.alert('Only a parent can change what someone can do.');
      return;
    }
    setRole(member.id, role);
  };

  const enrol = (kind: 'voice' | 'face') => {
    if (!canAdmin) {
      Alert.alert('Only a parent can enrol a voice or a face.');
      return;
    }
    setRecognition(member.id, kind, 'enrolled');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={member.name} subtitle={ROLE_LABELS[member.role]} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="items-center gap-3 py-8">
          <FamilyAvatar member={member} size={92} />
          <Text variant="h3">{member.name}</Text>
          {member.note ? <Text variant="muted" className="text-center">{member.note}</Text> : null}

          <View className="w-full flex-row justify-between px-6">
            <Text variant="small" className={member.home ? 'text-success' : 'text-muted-foreground'}>
              {member.home ? (member.room ?? 'Home') : 'Out'}
            </Text>
            <Text variant="small" className="text-muted-foreground">{member.points} points</Text>
            <Text variant="small" className="text-muted-foreground">{theirTasks.length} open tasks</Text>
          </View>

          <Button variant="secondary" size="sm" onPress={() => setHome(member.id, !member.home)}>
            <Text>{member.home ? 'Mark as out' : 'Mark as home'}</Text>
          </Button>
        </Card>

        <View className="gap-2">
          <Text variant="label">What the hub recognises</Text>
          {([
            { kind: 'voice' as const, icon: Microphone, title: 'Voice', blurb: 'Tells them apart from everyone else when they speak.' },
            { kind: 'face' as const, icon: ScanSmiley, title: 'Face', blurb: 'A second check on the cameras, for anything sensitive.' },
          ]).map((row) => {
            const state = member[row.kind];
            return (
              <Card key={row.kind} className="flex-row items-center gap-3 p-4">
                <Icon as={row.icon} weight={state === 'enrolled' ? 'fill' : 'regular'} size={20} className="text-primary" />
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium">{row.title}</Text>
                  <Text variant="muted">{row.blurb}</Text>
                </View>
                <Button variant={state === 'enrolled' ? 'secondary' : 'default'} size="sm" onPress={() => enrol(row.kind)}>
                  <Text>{state === 'enrolled' ? 'Set up' : state === 'learning' ? 'Finish' : 'Set up'}</Text>
                </Button>
              </Card>
            );
          })}
        </View>

        <View className="gap-2">
          <Text variant="label">What they can do</Text>
          <Text variant="muted">{ROLE_BLURBS[member.role]}</Text>
          <Card className="gap-4 p-4">
            <View className="flex-row gap-1 rounded-full bg-sunken p-1">
              {ROLES.map((role) => {
                const selected = role === member.role;
                return (
                  <Pressable
                    key={role}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => changeRole(role)}
                    className={cn('flex-1 items-center rounded-full py-2.5', selected && 'bg-card')}
                  >
                    <Text className={cn('text-sm font-medium', selected ? 'text-primary-soft-foreground' : 'text-muted-foreground')}>
                      {ROLE_LABELS[role]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View>
              <CardList>
                {capabilitiesFor(member.role).map((capability) => (
                  <View key={capability} className="flex-row items-center gap-2 py-2">
                    <Icon as={Check} weight="fill" size={14} className="text-primary" />
                    <Text variant="small" className="flex-1">{CAPABILITY_LABELS[capability]}</Text>
                  </View>
                ))}
              </CardList>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
