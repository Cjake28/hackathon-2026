import { Microphone, PaperPlaneTilt, Trash } from 'phosphor-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FamilyAvatar } from '@/components/FamilyAvatar';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useFamilyStore, useSpeaker } from '@/hooks/useFamily';
import { ROLE_LABELS } from '@/lib/family-permissions';
import { cn } from '@/lib/utils';
import { SUGGESTED_COMMANDS, useVoiceStore, WAKE_WORD } from '@/hooks/useVoice';

// Talking to the hub. Every line in the transcript carries who said it and
// which room, and the hub's answer depends on both (see useVoice's `ask`).
export default function TalkScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState('');

  const members = useFamilyStore((state) => state.members);
  const speaker = useSpeaker();

  const transcript = useVoiceStore((state) => state.transcript);
  const listenState = useVoiceStore((state) => state.listenState);
  const ask = useVoiceStore((state) => state.ask);
  const sleep = useVoiceStore((state) => state.sleep);
  const clear = useVoiceStore((state) => state.clear);

  const busy = listenState === 'thinking' || listenState === 'speaking';
  const suggestions = SUGGESTED_COMMANDS[speaker.role] ?? [];

  const send = () => {
    if (!text.trim() || busy) return;
    ask(text, speaker);
    setText('');
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={speaker.name}
        subtitle={`${ROLE_LABELS[speaker.role]}${speaker.room ? ` · ${speaker.room}` : ''}`}
        back
        right={
          transcript.length > 0 ? (
            <Button variant="ghost" size="icon" onPress={clear}>
              <Icon as={Trash} />
            </Button>
          ) : (
            <FamilyAvatar member={speaker} size={44} />
          )
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
          {transcript.length === 0 ? (
            <View className="items-center gap-4 pt-10">
              <Button size="icon" className="h-24 w-24 rounded-full" onPress={() => ask(WAKE_WORD, speaker)}>
                <Icon as={Microphone} weight="fill" size={32} className="text-primary-foreground" />
              </Button>
              <Text variant="h3" className="text-center">Say "{WAKE_WORD}"</Text>
              <Text variant="muted" className="max-w-xs text-center">
                It answers in the room it heard you, and only does what your voice is allowed to do.
              </Text>

              {speaker.role === 'guest' ? (
                <Card className="bg-accent-amber-soft p-3">
                  <Text variant="small" className="text-center text-accent-amber-onSoft">
                    This voice isn't recognised. It can ask the time and the weather — nothing else.
                  </Text>
                </Card>
              ) : null}

              <View className="flex-row flex-wrap justify-center gap-2">
                {suggestions.map((command) => (
                  <Button key={command} variant="secondary" size="sm" onPress={() => ask(command, speaker)}>
                    <Text>{command}</Text>
                  </Button>
                ))}
              </View>
            </View>
          ) : (
            transcript.map((line) => {
              const person = members.find((member) => member.id === line.personId);
              const isHub = line.speaker === 'hub';
              return (
                <View key={line.id} className={cn('max-w-[85%] gap-1', isHub ? 'self-start' : 'self-end items-end')}>
                  <Text variant="muted" className="text-xs">
                    {isHub ? 'Nova' : (person?.name ?? 'Unknown voice')}
                  </Text>
                  <Card className={cn('px-3 py-2', isHub ? (line.refused ? 'bg-destructive-soft' : 'bg-sunken') : 'bg-primary-soft')}>
                    <Text className={line.refused ? 'text-destructive' : undefined}>{line.text}</Text>
                  </Card>
                </View>
              );
            })
          )}
        </ScrollView>

        <View
          className="flex-row items-center gap-2 border-t border-border p-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          <Input
            className="flex-1"
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            editable={!busy}
            placeholder={speaker.role === 'guest' ? 'Ask the time or the weather…' : 'Say it, or type it…'}
          />
          {busy ? (
            <Button variant="outline" onPress={sleep}><Text>Stop</Text></Button>
          ) : (
            <Button size="icon" onPress={send} disabled={!text.trim()}>
              <Icon as={PaperPlaneTilt} weight="fill" className="text-primary-foreground" />
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
