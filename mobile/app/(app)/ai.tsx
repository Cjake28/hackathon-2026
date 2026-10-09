import { useRef, useState } from 'react';
import { CameraIcon, ImageIcon, PlusIcon, SquareIcon, Volume2Icon, XIcon } from 'lucide-react-native';
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { AiStatus } from '@/components/AiStatus';
import { MarkdownText } from '@/components/MarkdownText';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useAiStatus, useSpeech } from '@/hooks/useAi';
import {
  useConversation,
  useConversations,
  useCreateConversation,
  useResolveAction,
  useSendMessage,
  useUpdateConversation,
} from '@/hooks/useConversations';
import { pickImage } from '@/lib/image';
import { cn } from '@/lib/utils';
import type { ConversationMessage } from '@/types';

// Saved AI chats: pick one from the row at the top (the latest opens first), or start a new one.
export default function AiChatScreen() {
  const { data: list } = useConversations();
  const [picked, setPicked] = useState<number | 'new' | null>(null);
  const activeId = picked === 'new' ? undefined : (picked ?? list?.[0]?.id);
  const { data: conversation } = useConversation(activeId);
  const { data: status } = useAiStatus();
  const create = useCreateConversation();
  const update = useUpdateConversation();
  const send = useSendMessage();
  const resolve = useResolveAction(conversation?.id);
  const speech = useSpeech();
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null);
  // Settings for a chat that doesn't exist yet (it's created on the first message).
  const [newChat, setNewChat] = useState({ useDocs: false, useTools: false });
  const messages = useRef<FlatList<ConversationMessage>>(null);

  const settings = conversation ?? newChat;
  const setSetting = (key: 'useDocs' | 'useTools', on: boolean) =>
    conversation ? update.mutate({ id: conversation.id, [key]: on }) : setNewChat({ ...newChat, [key]: on });

  const submit = async () => {
    const content = input.trim();
    if (!content || send.isPending) return;
    let id = conversation?.id;
    if (!id) {
      id = (await create.mutateAsync(newChat)).id;
      setPicked(id);
    }
    send.mutate({ id, content, image: image ?? undefined });
    setInput('');
    setImage(null);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      className="flex-1 bg-background"
    >
      <View className="gap-2 border-b border-border p-3">
        <AiStatus />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Button size="sm" variant={activeId ? 'outline' : 'default'} onPress={() => setPicked('new')}>
            <Icon as={PlusIcon} />
            <Text>New</Text>
          </Button>
          {list?.map((c) => (
            <Button key={c.id} size="sm" variant={c.id === activeId ? 'default' : 'outline'} onPress={() => setPicked(c.id)}>
              <Text numberOfLines={1} className="max-w-36">
                {c.title}
              </Text>
            </Button>
          ))}
        </ScrollView>
        <View className="flex-row flex-wrap gap-4">
          <Pressable className="flex-row items-center gap-2" onPress={() => setSetting('useDocs', !settings.useDocs)}>
            <Checkbox checked={settings.useDocs} onCheckedChange={(on) => setSetting('useDocs', on)} />
            <Text className="text-sm">Use my documents</Text>
          </Pressable>
          {status?.tools && (
            <Pressable className="flex-row items-center gap-2" onPress={() => setSetting('useTools', !settings.useTools)}>
              <Checkbox checked={settings.useTools} onCheckedChange={(on) => setSetting('useTools', on)} />
              <Text className="text-sm">Allow app actions</Text>
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        ref={messages}
        data={conversation?.messages ?? []}
        keyExtractor={(m) => String(m.id)}
        contentContainerClassName="gap-3 p-4"
        onContentSizeChange={() => messages.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={<Text className="text-center text-muted-foreground">Ask anything to start.</Text>}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            speaking={speech.speakingId === item.id}
            onSpeak={() => speech.toggle(item.id, item.content)}
            onResolve={(approve) => resolve.mutate({ messageId: item.id, approve })}
            resolving={resolve.isPending}
          />
        )}
      />

      {image && (
        <View className="flex-row items-center gap-2 px-3">
          <Image source={{ uri: `data:image/jpeg;base64,${image}` }} className="h-16 w-16 rounded-md" />
          <Button variant="ghost" size="icon" onPress={() => setImage(null)}>
            <Icon as={XIcon} />
          </Button>
        </View>
      )}

      <View className="flex-row items-center gap-2 border-t border-border p-3">
        {status?.vision && (
          <>
            <Button testID="chat-camera" variant="outline" size="icon" onPress={async () => setImage((await pickImage('camera')) ?? image)}>
              <Icon as={CameraIcon} />
            </Button>
            <Button testID="chat-photo" variant="outline" size="icon" onPress={async () => setImage((await pickImage('library')) ?? image)}>
              <Icon as={ImageIcon} />
            </Button>
          </>
        )}
        <Input
          testID="chat-input"
          className="flex-1"
          placeholder={image ? 'Ask about the picture…' : 'Type a message…'}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
        />
        {send.isPending ? (
          <Button testID="chat-stop" variant="outline" onPress={send.stop}>
            <Text>Stop</Text>
          </Button>
        ) : (
          <Button testID="chat-send" onPress={submit} disabled={!input.trim()}>
            <Text>Send</Text>
          </Button>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble(props: {
  message: ConversationMessage;
  speaking: boolean;
  onSpeak: () => void;
  onResolve: (approve: boolean) => void;
  resolving: boolean;
}) {
  const { message: m } = props;
  const mine = m.role === 'user';

  return (
    <View className={cn('max-w-[85%] gap-1', mine ? 'self-end items-end' : 'self-start')}>
      {m.image && (
        <Image source={{ uri: `data:image/jpeg;base64,${m.image}` }} className="h-40 w-40 rounded-md" resizeMode="cover" />
      )}
      <View className={cn('rounded-lg px-3 py-2', mine ? 'bg-primary' : 'bg-muted')}>
        {mine || !m.content ? (
          <Text className={mine ? 'text-primary-foreground' : undefined}>{m.content || '…'}</Text>
        ) : (
          <MarkdownText>{m.content}</MarkdownText>
        )}
      </View>
      {!mine && !!m.sources?.length && (
        <Text className="text-xs text-muted-foreground">
          {m.sources.map((s) => `[${s.n}] ${s.title}${s.page ? ` p.${s.page}` : ''}`).join('  ')}
        </Text>
      )}
      {m.action && (
        <View className="gap-2 rounded-lg border border-border p-3">
          <Text className="text-sm font-medium">{m.action.description}</Text>
          {m.action.status === 'pending' && m.id > 0 ? (
            <View className="flex-row gap-2">
              <Button testID="action-confirm" size="sm" disabled={props.resolving} onPress={() => props.onResolve(true)}>
                <Text>Confirm</Text>
              </Button>
              <Button testID="action-cancel" size="sm" variant="outline" disabled={props.resolving} onPress={() => props.onResolve(false)}>
                <Text>Cancel</Text>
              </Button>
            </View>
          ) : (
            <Text className="text-xs text-muted-foreground">
              {m.action.status === 'done' ? 'Done' : m.action.status === 'cancelled' ? 'Cancelled' : 'Waiting…'}
            </Text>
          )}
        </View>
      )}
      {!mine && !!m.content && (
        <Button variant="ghost" size="sm" className="self-start" onPress={props.onSpeak}>
          <Icon as={props.speaking ? SquareIcon : Volume2Icon} />
          <Text>{props.speaking ? 'Stop' : 'Read aloud'}</Text>
        </Button>
      )}
    </View>
  );
}
