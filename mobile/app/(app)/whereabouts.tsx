import { House, MapPin, NavigationArrow, Plus, Trash } from 'phosphor-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardList } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import { useAddPlace, useDeletePlace, usePlaces, useWhereabouts } from '@/hooks/useHub';
import { NEEDS_REBUILD, askForLocation, currentLocation, hasLocation } from '@/lib/location';
import { relativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';

// Where everyone is, for Mom and Dad. Phones send their position only while the
// app is open and only to this house's hub; the list below is all it's used for,
// plus "Ana arrived at School" on the parents' phones.
export default function WhereaboutsScreen() {
  const can = useCan();
  const { data: people = [] } = useWhereabouts();
  const { data: places = [] } = usePlaces();
  const removePlace = useDeletePlace();

  const [naming, setNaming] = useState(false);

  const somewhere = people.filter((person) => person.place).length;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Where everyone is"
        subtitle={people.length === 0 ? 'Nobody sharing yet' : `${somewhere} of ${people.length} somewhere known`}
        back
      />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        {people.length === 0 ? (
          <EmptyState
            icon={NavigationArrow}
            title="No one is sharing"
            subtitle="Each person turns on “Share where I am” in their own Settings, and they show up here."
          />
        ) : (
          <View className="gap-2">
            <Text variant="label">Right now</Text>
            <Card className="p-4">
              <CardList>
                {people.map((person) => (
                  <View key={person.userId} className="flex-row items-center gap-3 py-2.5">
                    <FamilyAvatar member={{ id: person.userId, name: person.name }} size={40} />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>
                        {person.name}
                      </Text>
                      <Text variant="muted" numberOfLines={1}>
                        {person.place ? `At ${person.place} since ${relativeTime(person.since)}` : 'Out somewhere'}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Badge variant={person.place ? 'secondary' : 'outline'}>
                        <Text>{person.place ?? 'Away'}</Text>
                      </Badge>
                      <Text variant="small" className="text-muted-foreground">
                        {relativeTime(person.updatedAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </CardList>
            </Card>
          </View>
        )}

        <View className="gap-2">
          <Text variant="label">Places that count as somewhere</Text>
          <Text variant="muted">
            When someone arrives at one of these, Onai says so and you get it on your phone.
          </Text>

          {can('location.read') ? (
            !hasLocation() ? (
              <Text variant="muted">{NEEDS_REBUILD}</Text>
            ) : naming ? (
              <NewPlace onDone={() => setNaming(false)} />
            ) : (
              <Button testID="place-add" variant="secondary" onPress={() => setNaming(true)}>
                <Icon as={Plus} size={20} />
                <Text>Add this spot as a place</Text>
              </Button>
            )
          ) : null}

          {places.length === 0 ? (
            <EmptyState icon={MapPin} title="No places yet" subtitle="Stand where you want to name and add it." />
          ) : (
            <Card className="p-4">
              <CardList>
                {places.map((place) => (
                  <View key={place.id} className="flex-row items-center gap-3 py-2.5">
                    <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-soft">
                      <Icon
                        as={/^home$/i.test(place.name) ? House : MapPin}
                        weight="fill"
                        size={20}
                        className="text-primary-soft-foreground"
                      />
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium" numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text variant="muted">Counts from {place.radiusM} m away</Text>
                    </View>
                    {can('location.read') ? (
                      <Pressable
                        testID={`place-delete-${place.id}`}
                        hitSlop={10}
                        onPress={() => removePlace.mutate(place.id)}
                      >
                        <Icon as={Trash} size={18} className="text-destructive" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </CardList>
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const RADII = [100, 150, 300, 600];

// "Add this spot as a place": takes the phone's current position and gives it a name.
function NewPlace({ onDone }: { onDone: () => void }) {
  const add = useAddPlace();

  const [name, setName] = useState('');
  const [radiusM, setRadiusM] = useState(150);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    if (!(await askForLocation())) {
      setBusy(false);
      setError(hasLocation() ? 'Location is turned off for this app. Turn it on in your phone settings.' : NEEDS_REBUILD);
      return;
    }
    const coords = await currentLocation();
    if (!coords) {
      setBusy(false);
      setError("Couldn't work out where this phone is. Try again outside.");
      return;
    }
    add.mutate(
      { name: name.trim(), lat: coords.latitude, lng: coords.longitude, radiusM },
      { onSuccess: onDone, onSettled: () => setBusy(false) },
    );
  };

  return (
    <Card className="gap-3 p-4">
      <Text variant="label">Name this spot</Text>
      <Text variant="muted">It uses where this phone is now, so stand where you mean.</Text>

      <Input testID="place-name" placeholder="What to call it (e.g. School)" value={name} onChangeText={setName} />

      <View className="gap-1.5">
        <Text variant="small" className="text-muted-foreground">
          How close counts as arrived
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {RADII.map((option) => (
            <Button
              key={option}
              testID={`place-radius-${option}`}
              variant={radiusM === option ? 'default' : 'secondary'}
              size="sm"
              onPress={() => setRadiusM(option)}
            >
              <Text className={cn(radiusM === option && 'text-primary-foreground')}>{option} m</Text>
            </Button>
          ))}
        </View>
      </View>

      {error ? <Text className="text-destructive">{error}</Text> : null}

      <View className="flex-row gap-2">
        <Button variant="secondary" className="flex-1" onPress={onDone}>
          <Text>Cancel</Text>
        </Button>
        <Button
          testID="place-save"
          className="flex-1"
          disabled={!name.trim() || busy || add.isPending}
          onPress={save}
        >
          <Text className="text-primary-foreground">{busy ? 'Finding you…' : 'Add it'}</Text>
        </Button>
      </View>
    </Card>
  );
}
