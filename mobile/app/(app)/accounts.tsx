import { UsersThree } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateUser, useDeleteUser, useRoles, useUpdateUser, useUsers } from '@/hooks/useHub';
import { cn } from '@/lib/utils';
import { useRefresher } from '@/components/Refresher';

const chip = (on: boolean) =>
  cn('rounded-full px-3 py-1.5', on ? 'bg-primary' : 'border border-primary');

// Parents only (users.manage): make an account for each family member and pick its role. There's no sign-up.
export default function AccountsScreen() {
  const refresher = useRefresher();
  const can = useCan();
  const { data: me } = useMe();
  const { data: users = [] } = useUsers();
  const { data: roles = [] } = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);

  if (!can('users.manage')) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader title="Family accounts" back />
        <EmptyState icon={UsersThree} title="Only Mom or Dad can manage accounts" />
      </View>
    );
  }

  const ready = name.trim().length > 0 && login.trim().length > 0 && password.length >= 6 && roleId !== null;

  const add = () => {
    if (!ready || roleId === null) return;
    create.mutate(
      { name: name.trim(), email: login.trim(), password, roleId },
      {
        onSuccess: () => {
          setName('');
          setLogin('');
          setPassword('');
        },
      },
    );
  };

  const askDelete = (id: number, who: string) =>
    Alert.alert(`Delete ${who}?`, 'Their alarms, tasks and notes are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Family accounts" subtitle={`${users.length} on this hub`} back />

      <ScrollView refreshControl={refresher} className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        <View className="gap-2">
          <Text variant="label">Everyone</Text>
          {users.map((u) => (
            <Card key={u.id} className="gap-3 p-4">
              <View className="flex-row items-center gap-3">
                <FamilyAvatar member={u} size={48} />
                <View className="flex-1 gap-0.5">
                  <Text className="font-medium" numberOfLines={1}>
                    {u.name}
                  </Text>
                  <Text variant="muted" numberOfLines={1}>
                    Login: {u.email}
                  </Text>
                </View>
              </View>

              {/* Tap a role to move them to it. Your own role is locked. */}
              <View className="flex-row flex-wrap gap-2">
                {roles.map((r) => (
                  <Pressable
                    key={r.id}
                    testID={`account-${u.id}-role-${r.id}`}
                    disabled={u.id === me?.id || update.isPending}
                    onPress={() => update.mutate({ id: u.id, roleId: r.id })}
                    className={chip(r.id === u.roleId)}
                  >
                    <Text className={cn('text-sm', r.id === u.roleId && 'text-primary-foreground')}>{r.name}</Text>
                  </Pressable>
                ))}
              </View>

              {u.id === me?.id ? (
                <Text variant="small" className="text-muted-foreground">
                  This is you — your own role is locked.
                </Text>
              ) : (
                <Pressable testID={`account-delete-${u.id}`} hitSlop={8} onPress={() => askDelete(u.id, u.name)}>
                  <Text variant="small" className="text-destructive">
                    Delete
                  </Text>
                </Pressable>
              )}
            </Card>
          ))}
        </View>

        <View className="gap-2">
          <Text variant="label">Add someone</Text>
          <Card className="gap-3 p-4">
            <Input testID="account-name" placeholder="Name (e.g. Lola)" value={name} onChangeText={setName} />
            <Input
              testID="account-login"
              placeholder="Login (e.g. lola)"
              autoCapitalize="none"
              value={login}
              onChangeText={setLogin}
            />
            <Input
              testID="account-password"
              placeholder="Password (6 or more characters)"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View className="flex-row flex-wrap gap-2">
              {roles.map((r) => (
                <Pressable key={r.id} testID={`account-new-role-${r.id}`} onPress={() => setRoleId(r.id)} className={chip(r.id === roleId)}>
                  <Text className={cn('text-sm', r.id === roleId && 'text-primary-foreground')}>{r.name}</Text>
                </Pressable>
              ))}
            </View>
            <Button testID="account-add" disabled={!ready || create.isPending} onPress={add}>
              <Text className="text-primary-foreground">Add account</Text>
            </Button>
          </Card>
        </View>

        {can('roles.manage') ? (
          <Card className="bg-sunken p-4">
            <CardList>
              <Text variant="small" className="text-muted-foreground">
                What each role is allowed to do is on the Roles screen.
              </Text>
            </CardList>
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
