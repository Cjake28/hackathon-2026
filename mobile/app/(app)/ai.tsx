import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { AiStatus } from '@/components/AiStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useChat } from '@/hooks/useAi';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/types';

export default function AiChatScreen() {
  const { messages, send, pending, reset } = useChat();
  const [input, setInput] = useState('');
  const list = useRef<FlatList<ChatMessage>>(null);

  const submit = () => {
    if (!input.trim() || pending) return;
    send(input.trim());
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      className="flex-1 bg-background"
    >
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerClassName="gap-2 p-4"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View className="flex-row items-center justify-between">
            <AiStatus />
            {messages.length ? (
              <Button variant="ghost" size="sm" onPress={reset} disabled={pending}>
                <Text>New chat</Text>
              </Button>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Text className="text-center text-muted-foreground">Ask anything to start.</Text>}
        renderItem={({ item }) => (
          <View
            className={cn(
              'max-w-[85%] rounded-lg px-3 py-2',
              item.role === 'user' ? 'self-end bg-primary' : 'self-start bg-muted',
            )}
          >
            <Text className={item.role === 'user' ? 'text-primary-foreground' : undefined}>
              {item.content || '…'}
            </Text>
          </View>
        )}
      />
      <View className="flex-row gap-2 border-t border-border p-3">
        <Input
          testID="chat-input"
          className="flex-1"
          placeholder="Type a message…"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submit}
        />
        <Button testID="chat-send" onPress={submit} disabled={pending || !input.trim()}>
          <Text>Send</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}
