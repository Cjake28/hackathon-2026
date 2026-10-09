import { router } from 'expo-router';
import { CalendarBlank, Microphone } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDeleteEvent, useEvents, useHubFamily } from '@/hooks/useHub';
import type { HubEvent } from '@/types';

const DAY = new Intl.DateTimeFormat('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });
const CLOCK = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

/** Group events into day buckets, earliest first. */
function byDay(events: HubEvent[]) {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = new Map<string, HubEvent[]>();
  for (const event of sorted) {
    const key = DAY.format(new Date(event.startsAt));
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days.entries()];
}

// The family calendar, from the hub. Onai adds, moves and cancels events by voice ("Hey Onai, piano for Ana on
// Saturday at 4"); 15 min before each one the phone gets a heads-up. Long-press an event to delete it.
export default function CalendarScreen() {
  const { data: events = [] } = useEvents();
  const { data: family = [] } = useHubFamily();
  const remove = useDeleteEvent();
  const days = byDay(events);

  const askDelete = (event: HubEvent) =>
    Alert.alert(`Delete "${event.title}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(event.id) },
    ]);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Calendar"
        subtitle={events.length === 1 ? '1 coming up' : `${events.length} coming up`}
        back
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        <Button testID="calendar-add" onPress={() => router.push('/talk')}>
          <Icon as={Microphone} weight="fill" className="text-primary-foreground" />
          <Text className="text-primary-foreground">Add, move or cancel with Onai</Text>
        </Button>

        {days.length === 0 ? (
          <EmptyState
            icon={CalendarBlank}
            title="Nothing planned"
            subtitle={'Say "Hey Onai, piano on Saturday at 4" and it\'ll land here.'}
          />
        ) : (
          days.map(([day, dayEvents]) => (
            <View key={day} className="gap-2">
              <Text variant="label">{day}</Text>
              <Card className="p-4">
                <CardList>
                  {dayEvents.map((event) => {
                    const person = family.find((p) => p.id === event.userId);
                    return (
                      <Pressable
                        key={event.id}
                        testID={`event-${event.id}`}
                        onLongPress={() => askDelete(event)}
                        className="flex-row items-center gap-3 py-2.5"
                      >
                        {person ? (
                          <FamilyAvatar member={person} size={36} />
                        ) : (
                          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
                            <Text variant="small" className="text-primary-soft-foreground">
                              All
                            </Text>
                          </View>
                        )}
                        <View className="flex-1 gap-0.5">
                          <Text className="font-medium" numberOfLines={1}>
                            {event.title}
                          </Text>
                          <Text variant="muted">{person?.name ?? 'Whole family'}</Text>
                        </View>
                        <Badge variant="secondary">
                          <Text>{CLOCK.format(new Date(event.startsAt))}</Text>
                        </Badge>
                      </Pressable>
                    );
                  })}
                </CardList>
              </Card>
            </View>
          ))
        )}

        <Text variant="muted" className="text-center">
          Long-press anything to delete it.
        </Text>
      </ScrollView>
    </View>
  );
}
