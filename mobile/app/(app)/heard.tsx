import { Ear } from 'phosphor-react-native';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useHeard } from '@/hooks/useHub';
import { relativeTime } from '@/lib/time';
import { useRefresher } from '@/components/Refresher';

// The last things Onai heard out loud, newest first. Filled by the device poll
// (voice:heard notices) while the app is open — nothing is stored on the phone.
export default function HeardScreen() {
  const refresher = useRefresher();
  const { data: heard = [] } = useHeard();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="What Onai heard" subtitle="Said out loud in the house" back />

      <ScrollView refreshControl={refresher} className="flex-1" contentContainerClassName="gap-4 px-4 pb-10">
        <Card className="flex-row items-start gap-3 bg-accent-teal-soft p-4">
          <Icon as={Ear} weight="fill" size={20} className="text-accent-teal-onSoft" />
          <View className="flex-1 gap-1">
            <Text className="font-medium text-accent-teal-onSoft">Only while this screen is open</Text>
            <Text variant="small" className="text-accent-teal-onSoft">
              Nothing anyone says is saved on this phone. The recordings stay on the hub.
            </Text>
          </View>
        </Card>

        {heard.length === 0 ? (
          <EmptyState
            icon={Ear}
            title="Nothing yet"
            subtitle={'Say "Hey Onai" near the hub and it\'ll show up here.'}
          />
        ) : (
          heard.map((notice) => (
            <View key={notice.id} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="label">{notice.data?.speaker ?? 'Someone'}</Text>
                <Text variant="muted">{relativeTime(notice.createdAt)} ago</Text>
              </View>
              <Card className="gap-2 p-4">
                <Text>{notice.text}</Text>
                {notice.data?.reply ? (
                  <View className="gap-0.5 border-t border-border pt-2">
                    <Text variant="small" className="text-muted-foreground">
                      Onai
                    </Text>
                    <Text>{notice.data.reply}</Text>
                  </View>
                ) : null}
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
