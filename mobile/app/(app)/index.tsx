import { LogOutIcon } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useLogout, useMe } from '@/hooks/useAuth';

export default function HomeScreen() {
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="gap-4 p-4">
      <Text variant="h3">Welcome, {user?.name}</Text>
      <Text className="text-muted-foreground">
        Role: <Text className="font-medium">{user?.role}</Text>
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {user?.permissions.map((p) => (
          <Badge key={p} variant="secondary">
            <Text>{p === '*' ? 'All permissions' : p}</Text>
          </Badge>
        ))}
      </View>
      <Button variant="outline" onPress={() => logout.mutate()} disabled={logout.isPending}>
        <Icon as={LogOutIcon} />
        <Text>Log out</Text>
      </Button>
    </ScrollView>
  );
}
