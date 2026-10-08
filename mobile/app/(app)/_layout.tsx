import { Redirect, Tabs } from 'expo-router';
import { FileTextIcon, HomeIcon, ListChecksIcon, SparklesIcon } from 'lucide-react-native';
import { useCan, useMe } from '@/hooks/useAuth';

// Every screen in app/(app)/ requires login and is a tab here.
// Add a <Tabs.Screen> for every new screen. `href: null` hides the tab from users without the permission.
export default function AppLayout() {
  const { data: user, isLoading } = useMe();
  const can = useCan();

  if (isLoading) return null;
  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items',
          href: can('items.read') ? undefined : null,
          tabBarIcon: ({ color, size }) => <ListChecksIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI Chat',
          href: can('ai.use') ? undefined : null,
          tabBarIcon: ({ color, size }) => <SparklesIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="docs"
        options={{
          title: 'Docs',
          href: can('ai.use') ? undefined : null,
          tabBarIcon: ({ color, size }) => <FileTextIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
