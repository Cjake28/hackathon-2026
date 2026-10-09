import { CalendarBlank } from 'phosphor-react-native';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Card, CardList } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { FamilyEvent } from '@/types';

// Read-only for now: the hub fills this in by voice ("Hey Jarvis, piano on
// Saturday at 4"). Shown so the morning briefing has something to read out.
const EVENTS: FamilyEvent[] = [
  { id: 'e-piano', title: 'Piano lesson', startsAt: '2026-10-10T16:00:00.000Z', personId: 'Ana' },
  { id: 'e-dinner', title: 'Dinner with Lola', startsAt: '2026-10-10T19:00:00.000Z', personId: null },
  { id: 'e-football', title: 'Football practice', startsAt: '2026-10-11T07:30:00.000Z', personId: 'Ben' },
  { id: 'e-parents', title: "Parents' meeting at school", startsAt: '2026-10-12T09:00:00.000Z', personId: 'Mom' },
  { id: 'e-bills', title: 'Electricity bill due', startsAt: '2026-10-14T00:00:00.000Z', personId: null },
];

const DAY = new Intl.DateTimeFormat('en-PH', { weekday: 'long', day: 'numeric', month: 'long' });
const CLOCK = new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' });

/** Group events into day buckets, earliest first. */
function byDay(events: FamilyEvent[]) {
  const sorted = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const days = new Map<string, FamilyEvent[]>();
  for (const event of sorted) {
    const key = DAY.format(new Date(event.startsAt));
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return [...days.entries()];
}

export default function CalendarScreen() {
  const days = byDay(EVENTS);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Calendar" subtitle={`${EVENTS.length} coming up`} back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10">
        {days.length === 0 ? (
          <EmptyState
            icon={CalendarBlank}
            title="Nothing planned"
            subtitle={'Say "Hey Jarvis, piano on Saturday at 4" and it\'ll land here.'}
          />
        ) : (
          days.map(([day, events]) => (
            <View key={day} className="gap-2">
              <Text variant="label">{day}</Text>
              <Card className="p-4">
                <CardList>
                  {events.map((event) => {
                    const person = event.personId ? { id: event.personId, name: event.personId } : undefined;
                    return (
                      <View key={event.id} className="flex-row items-center gap-3 py-2.5">
                        {person ? (
                          <FamilyAvatar member={person} size={36} />
                        ) : (
                          <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
                            <Text variant="small" className="text-primary-soft-foreground">All</Text>
                          </View>
                        )}
                        <View className="flex-1 gap-0.5">
                          <Text className="font-medium" numberOfLines={1}>{event.title}</Text>
                          <Text variant="muted">{person?.name ?? 'Whole family'}</Text>
                        </View>
                        <Badge variant="secondary">
                          <Text>{CLOCK.format(new Date(event.startsAt))}</Text>
                        </Badge>
                      </View>
                    );
                  })}
                </CardList>
              </Card>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
