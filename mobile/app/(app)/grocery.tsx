import { Basket, Plus, Trash } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from '@/hooks/useItems';
import { cn } from '@/lib/utils';

// The household's shopping list, shared by every phone on the hub. Anyone can
// add; ticking something off is the whole interaction, so the rows are big and
// the checkbox is the hit target.
export default function GroceryScreen() {
  const can = useCan();
  const { data: items = [] } = useItems();
  const create = useCreateItem();
  const update = useUpdateItem();
  const remove = useDeleteItem();

  const [draft, setDraft] = useState('');

  const left = items.filter((item) => !item.done);
  const done = items.filter((item) => item.done);

  const submit = () => {
    if (!draft.trim()) return;
    create.mutate({ name: draft.trim() }, { onSuccess: () => setDraft('') });
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Grocery" subtitle={`${left.length} still to buy`} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        {can('items.create') ? (
          <View className="flex-row items-center gap-2">
            <Input
              testID="grocery-input"
              className="flex-1"
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={submit}
              placeholder="Add something…"
              returnKeyType="done"
            />
            <Button testID="grocery-add" size="icon" onPress={submit} disabled={!draft.trim() || create.isPending}>
              <Icon as={Plus} className="text-primary-foreground" />
            </Button>
          </View>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            icon={Basket}
            title="The list is empty"
            subtitle={'Say "Hey Onai, add rice to the grocery list" and it\'ll show up here.'}
          />
        ) : null}

        {left.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">To buy</Text>
            <Card className="p-4">
              <CardList>
                {left.map((item) => (
                  <View key={item.id} className="flex-row items-center gap-3 py-2.5">
                    <Checkbox
                      testID={`grocery-check-${item.id}`}
                      checked={false}
                      onCheckedChange={() => update.mutate({ id: item.id, done: true })}
                    />
                    <Pressable
                      className="flex-1"
                      onPress={() => update.mutate({ id: item.id, done: true })}
                    >
                      <Text className="font-medium" numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                    {can('items.delete') ? (
                      <Pressable testID={`grocery-delete-${item.id}`} hitSlop={10} onPress={() => remove.mutate(item.id)}>
                        <Icon as={Trash} size={18} className="text-destructive" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        ) : null}

        {done.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">In the basket</Text>
            <Card className="p-4">
              <CardList>
                {done.map((item) => (
                  <View key={item.id} className="flex-row items-center gap-3 py-2.5">
                    <Checkbox
                      testID={`grocery-uncheck-${item.id}`}
                      checked
                      onCheckedChange={() => update.mutate({ id: item.id, done: false })}
                    />
                    <Pressable className="flex-1" onPress={() => update.mutate({ id: item.id, done: false })}>
                      <Text className={cn('text-muted-foreground line-through')} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </Pressable>
                    {can('items.delete') ? (
                      <Pressable testID={`grocery-delete-${item.id}`} hitSlop={10} onPress={() => remove.mutate(item.id)}>
                        <Icon as={Trash} size={18} className="text-destructive" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
