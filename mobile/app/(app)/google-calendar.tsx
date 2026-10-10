import { CalendarCheck, CheckCircle, GoogleLogo, Lock, UsersThree, Warning } from 'phosphor-react-native';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan } from '@/hooks/useAuth';
import {
  useConnectFamilyCalendar,
  useConnectMyCalendar,
  useGoogleCalendar,
  useVerifyMyCalendar,
} from '@/hooks/useHub';

// Put a copy of your Onai events in your own Google Calendar (docs/google-calendar.md). Two steps, because typing
// a Gmail isn't proof it's yours: you share the calendar with the hub, the hub hides a one-time code inside it, and
// you type that code back. Events are saved on the hub first, so Google only ever gets a copy.
export default function GoogleCalendarScreen() {
  const can = useCan();
  const { data: google, isPending } = useGoogleCalendar();
  const connect = useConnectMyCalendar();
  const verify = useVerifyMyCalendar();
  const family = useConnectFamilyCalendar();

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [familyId, setFamilyId] = useState('');

  const busy = connect.isPending || verify.isPending || family.isPending;

  const disconnectMine = () =>
    Alert.alert(
      'Stop copying to Google?',
      'Your events stay on the hub and in the app. The copies Onai put in Google Calendar are removed.',
      [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: () => connect.mutate('') },
      ],
    );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Google Calendar" subtitle="Your events, also in your own calendar" back />

      <ScrollView className="flex-1" contentContainerClassName="gap-6 px-4 pb-10" keyboardShouldPersistTaps="handled">
        <Card className="flex-row items-start gap-3 bg-accent-teal-soft p-4">
          <Icon as={Lock} weight="fill" size={20} className="text-accent-teal-onSoft" />
          <View className="flex-1 gap-1">
            <Text className="font-medium text-accent-teal-onSoft">Your calendar can sync. Onai stays home.</Text>
            <Text variant="small" className="text-accent-teal-onSoft">
              Google only gets the name and time of your events, and only from the calendar you connect. What you say,
              your photos and what Onai remembers never leave the house — and every event is saved here first, so your
              calendar keeps working with the internet off.
            </Text>
          </View>
        </Card>

        {isPending ? null : !google?.enabled ? (
          <Card className="flex-row items-start gap-3 bg-accent-amber-soft p-4">
            <Icon as={Warning} weight="fill" size={20} className="text-accent-amber-onSoft" />
            <View className="flex-1 gap-1">
              <Text className="font-medium text-accent-amber-onSoft">Not switched on yet</Text>
              <Text variant="small" className="text-accent-amber-onSoft">
                Whoever set up the hub needs to give it a Google key first. Everything else works as usual in the
                meantime.
              </Text>
            </View>
          </Card>
        ) : (
          <>
            {/* Step 1 — sharing. Phones can't change calendar sharing, so this part happens on a computer. */}
            <View className="gap-1">
              <Text variant="label">1. Share your calendar</Text>
              <Text variant="muted">On a computer, at calendar.google.com</Text>
              <Card className="gap-3 p-4">
                <Text variant="small" className="text-muted-foreground">
                  Settings → your calendar → Share with specific people → add the address below, with “Make changes to
                  events”. Phones can't change sharing, so use the website.
                </Text>
                <View className="rounded-md bg-sunken px-3 py-2">
                  <Text selectable className="font-mono text-sm">
                    {google.shareWith}
                  </Text>
                </View>
              </Card>
            </View>

            {/* Step 2 — proving the calendar is yours: connected, waiting for a code, or not started. */}
            <View className="gap-1">
              <Text variant="label">2. Your calendar</Text>
              <Text variant="muted">
                {google.mine ? 'Connected' : google.pending ? 'Waiting for the code' : 'Not connected yet'}
              </Text>

              {google.mine ? (
                <Card className="gap-4 p-4">
                  <View className="flex-row items-center gap-3">
                    <Icon as={CheckCircle} weight="fill" size={22} className="text-accent-teal-onSoft" />
                    <View className="flex-1 gap-0.5">
                      <Text className="font-medium">{google.mine}</Text>
                      <Text variant="muted">New events show up there within seconds.</Text>
                    </View>
                  </View>
                  <Button variant="secondary" disabled={busy} onPress={disconnectMine}>
                    <Text>Disconnect</Text>
                  </Button>
                </Card>
              ) : google.pending ? (
                <Card className="gap-3 p-4">
                  <Text variant="small" className="text-muted-foreground">
                    Open {google.pending} in Google Calendar. There's an event today called “Jarvis code: ……”. Type the
                    six numbers here.
                  </Text>
                  <Input
                    testID="google-code"
                    placeholder="482913"
                    value={code}
                    onChangeText={setCode}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <View className="flex-row gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={busy}
                      onPress={() => {
                        setCode('');
                        connect.mutate('');
                      }}
                    >
                      <Text>Start again</Text>
                    </Button>
                    <Button
                      testID="google-verify"
                      className="flex-1"
                      disabled={busy || code.trim().length < 6}
                      onPress={() => verify.mutate(code.trim(), { onSuccess: () => setCode('') })}
                    >
                      <Text>{verify.isPending ? 'Checking…' : 'Verify'}</Text>
                    </Button>
                  </View>
                </Card>
              ) : (
                <Card className="gap-3 p-4">
                  <View className="flex-row items-center gap-3">
                    <Icon as={GoogleLogo} size={20} className="text-primary" />
                    <Text className="flex-1 font-medium">The Gmail you shared it from</Text>
                  </View>
                  <Input
                    testID="google-email"
                    placeholder="you@gmail.com"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <Button
                    testID="google-connect"
                    disabled={busy || !email.trim()}
                    onPress={() => connect.mutate(email.trim(), { onSuccess: () => setEmail('') })}
                  >
                    <Text>{connect.isPending ? 'Checking…' : 'Connect'}</Text>
                  </Button>
                  <Text variant="small" className="text-muted-foreground">
                    Onai then hides a code in that calendar, so only someone who can see it can connect it.
                  </Text>
                </Card>
              )}
            </View>

            {/* Family events belong to nobody in particular, so they go in a calendar everyone can see. Parents only. */}
            {can('users.manage') ? (
              <View className="gap-1">
                <Text variant="label">Family events</Text>
                <Text variant="muted">{google.family ? 'Connected' : 'A calendar the whole family can see'}</Text>
                <Card className="gap-3 p-4">
                  {google.family ? (
                    <>
                      <View className="flex-row items-center gap-3">
                        <Icon as={UsersThree} weight="fill" size={20} className="text-primary" />
                        <Text className="flex-1 font-medium" numberOfLines={2}>
                          {google.family}
                        </Text>
                      </View>
                      <Button variant="secondary" disabled={busy} onPress={() => family.mutate('')}>
                        <Text>Disconnect</Text>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Text variant="small" className="text-muted-foreground">
                        Make a calendar called “Family” on calendar.google.com, share it with the address above and with
                        everyone at home, then paste its calendar ID here (its settings → Integrate calendar).
                      </Text>
                      <Input
                        testID="google-family"
                        placeholder="…@group.calendar.google.com"
                        value={familyId}
                        onChangeText={setFamilyId}
                        autoCapitalize="none"
                      />
                      <Button
                        testID="google-family-connect"
                        disabled={busy || !familyId.trim()}
                        onPress={() => family.mutate(familyId.trim(), { onSuccess: () => setFamilyId('') })}
                      >
                        <Text>{family.isPending ? 'Checking…' : 'Connect'}</Text>
                      </Button>
                    </>
                  )}
                </Card>
              </View>
            ) : null}

            <Card className="flex-row items-start gap-3 bg-sunken p-4">
              <Icon as={CalendarCheck} size={20} className="text-muted-foreground" />
              <Text variant="small" className="flex-1 text-muted-foreground">
                Moving, renaming or cancelling an event changes the copy too. Changes you make in Google Calendar don't
                come back here.
              </Text>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
