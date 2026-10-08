import { useState } from 'react';
import { Trash2Icon } from 'lucide-react-native';
import { FlatList, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useCreateItem, useDeleteItem, useItems, useUpdateItem } from '@/hooks/useItems';

export default function ItemsScreen() {
  const { data: items, isLoading, refetch, isRefetching } = useItems();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const can = useCan();
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    createItem.mutate({ name }, { onSuccess: () => setName('') });
  };

  return (
    <FlatList
      className="flex-1 bg-background"
      contentContainerClassName="gap-2 p-4"
      data={items ?? []}
      keyExtractor={(item) => String(item.id)}
      refreshing={isRefetching}
      onRefresh={refetch}
      ListHeaderComponent={
        can('items.create') ? (
          <View className="mb-2 flex-row gap-2">
            <Input
              className="flex-1"
              placeholder="New item"
              value={name}
              onChangeText={setName}
              onSubmitEditing={add}
            />
            <Button onPress={add} disabled={createItem.isPending}>
              <Text>Add</Text>
            </Button>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <Text className="text-center text-muted-foreground">
          {isLoading ? 'Loading…' : 'No items yet.'}
        </Text>
      }
      renderItem={({ item }) => (
        <Card className="flex-row items-center gap-3 px-4 py-3">
          <Checkbox
            checked={item.done}
            disabled={!can('items.update')}
            onCheckedChange={(checked) => updateItem.mutate({ id: item.id, done: checked })}
          />
          <Text className="flex-1">{item.name}</Text>
          <Badge variant={item.done ? 'secondary' : 'outline'}>
            <Text>{item.done ? 'Done' : 'Open'}</Text>
          </Badge>
          {can('items.delete') && (
            <Button variant="ghost" size="icon" onPress={() => deleteItem.mutate(item.id)}>
              <Icon as={Trash2Icon} />
            </Button>
          )}
        </Card>
      )}
    />
  );
}
