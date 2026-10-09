import { Tabs } from 'expo-router';
import { Alarm, CheckSquare, HardDrives, House, Users } from 'phosphor-react-native';
import { FloatingTabBar, TabIcon } from '@/components/FloatingTabBar';

// Five tabs — Home, Tasks, Family, Alarms, Hub — rendered by a minimal,
// docked tab bar (see FloatingTabBar / TAB_BAR_CLEARANCE).
export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon as={House} focused={focused} /> }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: 'Tasks', tabBarIcon: ({ focused }) => <TabIcon as={CheckSquare} focused={focused} /> }}
      />
      <Tabs.Screen
        name="family"
        options={{ title: 'Family', tabBarIcon: ({ focused }) => <TabIcon as={Users} focused={focused} /> }}
      />
      <Tabs.Screen
        name="alarms"
        options={{ title: 'Alarms', tabBarIcon: ({ focused }) => <TabIcon as={Alarm} focused={focused} /> }}
      />
      <Tabs.Screen
        name="hub"
        options={{ title: 'Hub', tabBarIcon: ({ focused }) => <TabIcon as={HardDrives} focused={focused} /> }}
      />
    </Tabs>
  );
}
