import { router } from 'expo-router';
import { Ear, Trophy, UsersThree } from 'phosphor-react-native';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useHubFamily, usePoints } from '@/hooks/useHub';
import { relativeTime } from '@/lib/time';

// The household, straight from the hub: who's in, who's out, and how each
// person is doing on chores. "Home" means their phone reached the hub in the
// last couple of minutes, so it keeps itself up to date.
export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const can = useCan();
  const { data: me } = useMe();
  const { data: people = [] } = useHubFamily();
  const { data: points = [] } = usePoints();

  const home = people.filter((person) => person.isHome);
  const pointsFor = (userId: number) => points.find((row) => row.userId === userId);

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <View>
          <Text variant="h3">Family</Text>
          <Text variant="muted">
            {home.length} of {people.length} home
          </Text>
        </View>
        {can('users.manage') ? (
          <Button variant="ghost" size="icon" testID="family-accounts" onPress={() => router.push('/accounts')}>
            <Icon as={UsersThree} size={24} />
          </Button>
        ) : null}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-4"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}
      >
        {people.length === 0 ? (
          <EmptyState
            icon={UsersThree}
            title="Nobody to show"
            subtitle="Only Mom and Dad can see who's home. Ask them to check your account."
          />
        ) : null}

        {people.length > 0 ? (
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="label">Everyone</Text>
              <Text variant="muted">Tap for their details</Text>
            </View>
            <View className="gap-2">
              {people.map((person) => {
                const score = pointsFor(person.id);
                return (
                  <Pressable
                    key={person.id}
                    testID={`family-member-${person.id}`}
                    onPress={() => router.push(`/member/${person.id}`)}
                  >
                    <Card className="flex-row items-center gap-4 p-4">
                      <FamilyAvatar member={person} size={60} />
                      <View className="flex-1 gap-1">
                        <View className="flex-row items-center gap-2">
                          <Text className="font-medium" numberOfLines={1}>
                            {person.name}
                          </Text>
                          {person.id === me?.id ? (
                            <Badge variant="secondary">
                              <Text>You</Text>
                            </Badge>
                          ) : null}
                        </View>
                        <Text variant="muted" numberOfLines={1}>
                          {person.isHome
                            ? 'Home now'
                            : person.lastSeenAt
                              ? `Out · last home ${relativeTime(person.lastSeenAt)} ago`
                              : 'Out'}
                        </Text>
                        {score && score.choresDone > 0 ? (
                          <View className="flex-row items-center gap-1 pt-0.5">
                            <Icon as={Trophy} weight="fill" size={12} className="text-accent-amber-base" />
                            <Text variant="small" className="text-muted-foreground">
                              {score.points} points · {score.choresDone} chores
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View
                        className={`h-3 w-3 rounded-full ${person.isHome ? 'bg-success' : 'bg-muted-foreground/40'}`}
                      />
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {points.length > 0 ? (
          <View className="gap-2">
            <Text variant="label">Chore leaderboard</Text>
            <Card className="p-4">
              <CardList>
                {points.map((row, index) => (
                  <View key={row.userId} className="flex-row items-center gap-3 py-2">
                    <Text variant="large" className="w-6 text-muted-foreground">
                      {index + 1}
                    </Text>
                    <FamilyAvatar member={{ id: row.userId, name: row.name }} size={36} />
                    <Text className="flex-1 font-medium" numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      {row.points} pts
                    </Text>
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        ) : null}

        {can('presence.read') ? (
          <Pressable testID="family-heard" onPress={() => router.push('/heard')}>
            <Card className="flex-row items-center gap-3 bg-accent-teal-soft p-4">
              <Icon as={Ear} weight="fill" size={24} className="text-accent-teal-onSoft" />
              <View className="flex-1 gap-0.5">
                <Text className="font-medium text-accent-teal-onSoft">What Jarvis heard</Text>
                <Text variant="small" className="text-accent-teal-onSoft">
                  The last things said out loud in the house, and what Jarvis answered.
                </Text>
              </View>
            </Card>
          </Pressable>
        ) : null}

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-muted-foreground">
            Voices are recognised on the hub and never leave it. Someone counts as home when their phone can reach the
            hub on the house wifi.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
