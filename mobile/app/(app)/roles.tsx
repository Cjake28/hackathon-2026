import { ShieldCheck } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateRole, useDeleteRole, usePermissionList, useRoles, useUpdateRole } from '@/hooks/useHub';
import { cn } from '@/lib/utils';
import type { RoleRow } from '@/types';

// What each permission lets someone do (names come from GET /roles/permissions).
const LABELS: Record<string, string> = {
  'ai.use': 'Talk to Onai',
  'alarms.own': 'Own alarms and reminders',
  'alarms.family': "Set other people's alarms",
  'tasks.own': 'Own tasks and chores',
  'tasks.assign': 'Give tasks to others',
  'presence.read': "See who's home",
  'memory.own': 'Onai remembers things about me',
  'intercom.send': 'Announce to everyone',
  'items.read': 'See the grocery list',
  'items.create': 'Add to the grocery list',
  'items.update': 'Check off groceries',
  'items.delete': 'Delete groceries',
  'calendar.use': 'Family calendar',
  'budget.use': 'Family budget',
  'location.share': 'Share my location',
  'location.read': "See everyone's location",
  'users.manage': 'Make and delete accounts',
  'roles.manage': 'Edit roles and permissions',
  'docs.manage': 'Manage documents',
  'ai.manage': "Pick the hub's AI model",
};

const chip = (on: boolean) => cn('rounded-full px-3 py-1.5', on ? 'bg-primary' : 'border border-primary');

// Parents only (roles.manage): make roles (e.g. "grandparent", "yaya") and tap permissions on and off.
// Changes apply right away to everyone with that role. Your own role is locked so you can't lock yourself out.
export default function RolesScreen() {
  const can = useCan();
  const { data: me } = useMe();
  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissionList();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState('');

  if (!can('roles.manage')) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Roles" back />
        <EmptyState icon={ShieldCheck} title="Only Mom or Dad can edit roles" />
      </View>
    );
  }

  const toggle = (role: RoleRow, permission: string) =>
    update.mutate({
      id: role.id,
      permissions: role.permissions.includes(permission)
        ? role.permissions.filter((p) => p !== permission)
        : [...role.permissions, permission],
    });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Roles" subtitle="What each role is allowed to do" back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        {roles.map((role) => {
          const mine = role.id === me?.roleId;
          return (
            <View key={role.id} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="label">{role.name}</Text>
                <Text variant="muted">
                  {role._count.users} {role._count.users === 1 ? 'person' : 'people'}
                  {mine ? ' · your role (locked)' : ''}
                </Text>
              </View>
              <Card className="gap-3 p-4">
                {role.permissions.includes('*') ? (
                  <Text variant="muted">Everything (admin)</Text>
                ) : (
                  <View className="flex-row flex-wrap gap-2">
                    {permissions.map((p) => {
                      const on = role.permissions.includes(p);
                      return (
                        <Pressable
                          key={p}
                          testID={`role-${role.id}-${p}`}
                          disabled={mine || update.isPending}
                          onPress={() => toggle(role, p)}
                          className={chip(on)}
                        >
                          <Text className={cn('text-sm', on && 'text-primary-foreground')}>{LABELS[p] ?? p}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {!mine && role._count.users === 0 ? (
                  <Pressable testID={`role-delete-${role.id}`} hitSlop={8} onPress={() => remove.mutate(role.id)}>
                    <Text variant="small" className="text-destructive">
                      Delete role
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            </View>
          );
        })}

        <View className="gap-2">
          <Text variant="label">New role</Text>
          <Card className="gap-3 p-4">
            <Input testID="role-name" placeholder="e.g. grandparent, yaya" value={name} onChangeText={setName} />
            <Button
              testID="role-add"
              disabled={!name.trim() || create.isPending}
              onPress={() => create.mutate({ name: name.trim(), permissions: ['ai.use'] }, { onSuccess: () => setName('') })}
            >
              <Text className="text-primary-foreground">Add role</Text>
            </Button>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}
