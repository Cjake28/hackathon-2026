import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useUpdateUser } from '@/hooks/useHub';

// Your account on this hub. Mom and Dad can change their own name here; for
// everyone else it's read-only, because only a parent can edit an account
// (Settings → Family accounts).
export default function PersonalInfoScreen() {
  const { data: me } = useMe();
  const can = useCan();
  const update = useUpdateUser();

  const [name, setName] = useState(me?.name ?? '');
  const editable = can('users.manage');
  const dirty = name.trim().length > 0 && name !== me?.name;

  const save = () => {
    if (!me || !dirty) return;
    update.mutate({ id: me.id, name: name.trim() }, { onSuccess: () => router.back() });
  };

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-4 pb-6" keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Your details" subtitle="How you appear on this hub" />

          <Card className="gap-5 p-6">
            <View className="items-center gap-2">
              <FamilyAvatar member={{ id: me?.id ?? 0, name: name || me?.name || 'You' }} size={92} />
              <Text variant="small" className="text-center text-muted-foreground">
                Your initials stand in until you add a picture.
              </Text>
            </View>

            {editable ? (
              <View className="gap-2">
                <Text variant="label">Name</Text>
                <Input
                  testID="me-name"
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={save}
                />
              </View>
            ) : null}

            <CardList>
              {!editable ? (
                <View className="flex-row items-center gap-3 py-2.5">
                  <Text className="flex-1" variant="muted">
                    Name
                  </Text>
                  <Text className="font-medium">{me?.name}</Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-3 py-2.5">
                <Text className="flex-1" variant="muted">
                  Login
                </Text>
                <Text className="font-medium">{me?.email}</Text>
              </View>
              <View className="flex-row items-center gap-3 py-2.5">
                <Text className="flex-1" variant="muted">
                  Can do
                </Text>
                <Text className="font-medium">{me?.role}</Text>
              </View>
            </CardList>

            {!editable ? (
              <Text variant="small" className="text-muted-foreground">
                Ask Mom or Dad to change your name, login or password.
              </Text>
            ) : null}
          </Card>
        </ScrollView>

        {editable ? (
          <View className="border-t border-border p-4">
            <Button testID="me-save" disabled={!dirty || update.isPending} onPress={save}>
              <Text className="text-primary-foreground">Save changes</Text>
            </Button>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
