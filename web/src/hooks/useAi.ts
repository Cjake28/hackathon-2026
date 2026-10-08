import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { streamText } from '@/lib/api';
import type { ChatMessage } from '@/types';

// AI chat with a streamed reply. The conversation lives in component state (not saved).
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const appendToReply = (text: string) =>
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      return [...prev.slice(0, -1), { ...last, content: last.content + text }];
    });

  const chat = useMutation({
    mutationFn: (history: ChatMessage[]) => streamText('/ai/chat', { messages: history }, appendToReply),
    onMutate: (history) => setMessages([...history, { role: 'assistant', content: '' }]),
    onError: (_error, history) => setMessages(history), // drop the unfinished reply; the toast shows why
  });

  return {
    messages,
    pending: chat.isPending,
    send: (content: string) => chat.mutate([...messages, { role: 'user', content }]),
    reset: () => setMessages([]),
  };
}
