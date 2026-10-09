import { router } from 'expo-router';
import { Microphone, ScanSmiley, UserMinus } from 'phosphor-react-native';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { TAB_BAR_CLEARANCE } from '@/components/FloatingTabBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { can, ROLE_LABELS } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import type { FamilyMember, RecognitionState } from '@/types';

const RECOGNITION: Record<RecognitionState, { label: string; bg: string; fg: string }> = {
  enrolled: { label: 'Set up', bg: 'bg-accent-teal-soft', fg: 'text-accent-teal-onSoft' },
  learning: { label: 'Still learning', bg: 'bg-accent-amber-soft', fg: 'text-accent-amber-onSoft' },
  none: { label: 'Not set up', bg: 'bg-accent-rose-soft', fg: 'text-accent-rose-onSoft' },
};

function RecognitionChip({ icon, state }: { icon: React.ComponentProps<typeof Icon>['as']; state: RecognitionState }) {
  const info = RECOGNITION[state];
  return (
    <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-1', info.bg)}>
      <Icon as={icon} weight={state === 'enrolled' ? 'fill' : 'regular'} size={12} className={info.fg} />
      <Text className={cn('text-xs', info.fg)}>{info.label}</Text>
    </View>
  );
}

// The household, and what the hub can recognise about each person. Tapping a
// member switches who the hub hears — that's the permission demo's switch.
export default function FamilyScreen() {
  const insets = useSafeAreaInsets();
  const members = useFamilyStore((state) => state.members);
  const setSpeaker = useFamilyStore((state) => state.setSpeaker);
  const speaker = useSpeaker();

  const enrolled = members.filter((member) => member.voice === 'enrolled');
  const canAdmin = can(speaker.role, 'hubAdmin');

  const switchTo = (member: FamilyMember) => {
    if (!canAdmin) {
      Alert.alert('Only a parent can change who the hub hears.');
      return;
    }
    setSpeaker(member.id);
  };

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3" style={{ paddingTop: insets.top + 8 }}>
        <Text variant="h3">Family</Text>
        <Button variant="ghost" size="icon" onPress={() => setSpeaker(null)}>
          <Icon as={UserMinus} />
        </Button>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4" contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE }}>
        <Card className="items-center gap-3 py-8">
          <FamilyAvatar member={speaker} size={84} />
          <View className="items-center gap-1">
            <Text variant="muted">Currently hearing</Text>
            <Text variant="h3">{speaker.name}</Text>
            <Text variant="small" className="max-w-xs text-center text-muted-foreground">
              {speaker.role === 'guest'
                ? 'An unrecognised voice. It can ask the time and the weather, and nothing else.'
                : `Recognised by voice${speaker.face === 'enrolled' ? ' and face' : ''}. Acting as a ${ROLE_LABELS[speaker.role].toLowerCase()}.`}
            </Text>
          </View>
          <Text variant="small" className="text-muted-foreground">{enrolled.length} of {members.length} voices known</Text>
        </Card>

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Text variant="label">Everyone</Text>
            <Text variant="muted">Tap to hear them instead</Text>
          </View>
          <View className="gap-2">
            {members.map((member) => {
              return (
                <Pressable key={member.id} onPress={() => switchTo(member)} onLongPress={() => router.push(`/member/${member.id}`)}>
                  <Card className="flex-row items-center gap-4 p-4">
                    <FamilyAvatar member={member} size={60} />
                    <View className="flex-1 gap-1">
                      <Text className="font-medium" numberOfLines={1}>{member.name}</Text>
                      <Text variant="muted" numberOfLines={1}>
                        {[ROLE_LABELS[member.role], member.home ? (member.room ?? 'Home') : 'Out', member.role === 'child' ? `${member.points} points` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <View className="flex-row gap-1.5 pt-0.5">
                        <RecognitionChip icon={Microphone} state={member.voice} />
                        <RecognitionChip icon={ScanSmiley} state={member.face} />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Card className="bg-sunken p-4">
          <Text variant="small" className="text-muted-foreground">
            Voice prints and face prints are made on this hub and never leave it. Deleting someone deletes theirs with them.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
