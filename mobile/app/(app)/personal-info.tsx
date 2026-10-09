import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useSpeaker, useFamilyStore } from '@/hooks/useFamily';

// Your details on this device — presented as a modal, Save pinned to the
// bottom and disabled until something actually changes.
export default function PersonalInfoScreen() {
  const speaker = useSpeaker();
  const updateMember = useFamilyStore((state) => state.updateMember);

  const [name, setName] = useState(speaker.name);
  const [note, setNote] = useState(speaker.note ?? '');
  const dirty = name !== speaker.name || note !== (speaker.note ?? '');

  const save = () => {
    updateMember(speaker.id, { name: name.trim() || speaker.name, note: note.trim() || undefined });
    router.back();
  };

  return (
    <View className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-4 pb-6" keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Your details" subtitle="How you appear on this hub" />

          <Card className="gap-5 p-6">
            <View className="items-center gap-2">
              <FamilyAvatar member={{ ...speaker, name: name || 'You' }} size={92} />
              <Text variant="small" className="text-center text-muted-foreground">
                Your initials stand in until you add a picture.
              </Text>
            </View>

            <View className="gap-2">
              <Text variant="label">Name</Text>
              <Input value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" returnKeyType="next" />
            </View>

            <View className="gap-2">
              <Text variant="label">Note</Text>
              <Input value={note} onChangeText={setNote} placeholder="Shown under your name on the Family tab" returnKeyType="done" onSubmitEditing={save} />
            </View>
          </Card>
        </ScrollView>

        <View className="border-t border-border p-4">
          <Button disabled={!dirty} onPress={save}>
            <Text className="text-primary-foreground">Save changes</Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
