import { Brain, Lock, Trash } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDeleteMemory, useMemory } from '@/hooks/useHub';
import { relativeTime } from '@/lib/time';
import type { MemoryNote } from '@/types';

// "What Onai remembers about me", with a delete on every line. Only your own
// notes: nobody else can read what the hub keeps about you.
export default function MemoryScreen() {
  const { data: notes = [] } = useMemory();
  const remove = useDeleteMemory();

  const confirmForget = (note: MemoryNote) =>
    Alert.alert(note.text, 'Forget this?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Forget it', style: 'destructive', onPress: () => remove.mutate(note.id) },
    ]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="What Onai remembers"
        subtitle={notes.length === 1 ? '1 note about you' : `${notes.length} notes about you`}
        back
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Card className="flex-row items-start gap-3 bg-accent-teal-soft p-4">
          <Icon as={Lock} weight="fill" size={20} className="text-accent-teal-onSoft" />
          <View className="flex-1 gap-1">
            <Text className="font-medium text-accent-teal-onSoft">These notes never leave the house</Text>
            <Text variant="small" className="text-accent-teal-onSoft">
              Onai writes them down so it can answer better, and only you can see yours. Delete any of them and it
              forgets, for good.
            </Text>
          </View>
        </Card>

        {notes.length === 0 ? (
          <EmptyState
            icon={Brain}
            title="Nothing remembered yet"
            subtitle="As you talk to Onai, the things worth keeping show up here."
          />
        ) : (
          <Card className="p-4">
            <CardList>
              {notes.map((note) => (
                <View key={note.id} className="flex-row items-center gap-3 py-2.5">
                  <View className="flex-1 gap-0.5">
                    <Text className="font-medium">{note.text}</Text>
                    <Text variant="muted">Noted {relativeTime(note.createdAt)} ago</Text>
                  </View>
                  <Pressable
                    testID={`memory-delete-${note.id}`}
                    hitSlop={10}
                    disabled={remove.isPending}
                    onPress={() => confirmForget(note)}
                  >
                    <Icon as={Trash} size={20} className="text-destructive" />
                  </Pressable>
                </View>
              ))}
            </CardList>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}
