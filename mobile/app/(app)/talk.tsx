import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { Microphone, PaperPlaneTilt, Trash } from 'phosphor-react-native';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { MarkdownText } from '@/components/MarkdownText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useMe } from '@/hooks/useAuth';
import { useTalk } from '@/hooks/useHub';
import { cn } from '@/lib/utils';

const WAKE_WORD = 'Hey Onai';

const SUGGESTIONS: Record<string, string[]> = {
  parent: [
    'Tell Ben to put the bins out',
    'Wake Ana up in one minute',
    'Add rice to the grocery list',
    "Who's home?",
    "What's on the calendar this week?",
    'Add piano for Ana on Saturday at 4',
    'Move the parents meeting to 6 PM',
  ],
  child: [
    'Set an alarm for 7 oʼclock',
    "What's on my list today?",
    'Add pandesal to the grocery list',
    "What's on the calendar this week?",
  ],
  guest: ['What time is it?'],
};

type Line = { id: number; from: 'me' | 'onai'; text: string };

// Talking to Onai on the hub. Typed here, spoken at the hub's mic — same brain
// either way. When Onai asks to confirm something, the Yes and No buttons
// answer it; nothing changes in the house until then.
export default function TalkScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const nextId = useRef(0);

  // Leaving the screen stops Onai mid-sentence.
  useEffect(() => () => void Speech.stop(), []);

  const { data: me } = useMe();
  const talk = useTalk();
  const { say } = useLocalSearchParams<{ say?: string }>();

  const [text, setText] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState(false);

  const send = (what: string) => {
    const trimmed = what.trim();
    if (!trimmed || talk.isPending) return;
    nextId.current += 1;
    setLines((old) => [...old, { id: nextId.current, from: 'me', text: trimmed }]);
    setText('');
    talk.mutate(trimmed, {
      onSuccess: (reply) => {
        nextId.current += 1;
        setLines((old) => [...old, { id: nextId.current, from: 'onai', text: reply.reply }]);
        setPending(reply.pending);
        // Onai answers out loud, in the phone's own voice (works offline).
        Speech.stop();
        Speech.speak(reply.reply.replace(/[*#_`>]/g, ''));
      },
    });
  };

  // Opened from a suggestion on the home screen: ask it straight away.
  const asked = useRef(false);
  useEffect(() => {
    if (say && !asked.current) {
      asked.current = true;
      send(say);
    }
  }, [say]);

  const suggestions = SUGGESTIONS[me?.role ?? 'child'] ?? SUGGESTIONS.child;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title="Onai"
        subtitle={me ? `Talking as ${me.name}` : undefined}
        back
        right={
          lines.length > 0 ? (
            <Button variant="ghost" size="icon" onPress={() => { setLines([]); setPending(false); }}>
              <Icon as={Trash} />
            </Button>
          ) : me ? (
            <FamilyAvatar member={me} size={44} />
          ) : undefined
        }
      />

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerClassName="gap-4 px-4 pb-6"
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {lines.length === 0 ? (
            <View className="items-center gap-4 pt-10">
              {/* Opens the keyboard — its own 🎤 key turns speech into the text below. */}
              <Pressable
                testID="talk-mic"
                onPress={() => inputRef.current?.focus()}
                className="h-24 w-24 items-center justify-center rounded-full bg-primary"
              >
                <Icon as={Microphone} weight="fill" size={32} className="text-primary-foreground" />
              </Pressable>
              <Text variant="h3" className="text-center">
                Say "{WAKE_WORD}"
              </Text>
              <Text variant="muted" className="max-w-xs text-center">
                Or type it here. Onai only does what your account is allowed to do.
              </Text>

              <View className="flex-row flex-wrap justify-center gap-2">
                {suggestions.map((command) => (
                  <Button key={command} variant="secondary" size="sm" onPress={() => send(command)}>
                    <Text>{command}</Text>
                  </Button>
                ))}
              </View>
            </View>
          ) : (
            lines.map((line) => {
              const isOnai = line.from === 'onai';
              return (
                <View
                  key={line.id}
                  className={cn('max-w-[85%] gap-1', isOnai ? 'self-start' : 'items-end self-end')}
                >
                  <Text variant="muted" className="text-xs">
                    {isOnai ? 'Onai' : (me?.name ?? 'You')}
                  </Text>
                  <Card className={cn('px-3 py-2', isOnai ? 'bg-sunken' : 'bg-primary-soft')}>
                    {isOnai ? <MarkdownText>{line.text}</MarkdownText> : <Text>{line.text}</Text>}
                  </Card>
                </View>
              );
            })
          )}

          {talk.isPending ? (
            <View className="max-w-[85%] gap-1 self-start">
              <Text variant="muted" className="text-xs">
                Onai
              </Text>
              <Card className="bg-sunken px-3 py-2">
                <Text variant="muted">Thinking…</Text>
              </Card>
            </View>
          ) : null}
        </ScrollView>

        {/* Onai asked to confirm before changing anything. */}
        {pending && !talk.isPending ? (
          <View className="flex-row gap-2 border-t border-border px-3 pt-3">
            <Button testID="talk-yes" className="flex-1" onPress={() => send('yes')}>
              <Text className="text-primary-foreground">Yes, do it</Text>
            </Button>
            <Button testID="talk-no" variant="secondary" className="flex-1" onPress={() => send('no')}>
              <Text>No, cancel</Text>
            </Button>
          </View>
        ) : null}

        <View
          className="flex-row items-center gap-2 border-t border-border p-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Input
            ref={inputRef}
            testID="talk-input"
            className="flex-1"
            value={text}
            onChangeText={setText}
            onSubmitEditing={() => send(text)}
            editable={!talk.isPending}
            placeholder="Say it, or type it…"
          />
          <Button testID="talk-send" size="icon" onPress={() => send(text)} disabled={!text.trim() || talk.isPending}>
            <Icon as={PaperPlaneTilt} weight="fill" className="text-primary-foreground" />
          </Button>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
