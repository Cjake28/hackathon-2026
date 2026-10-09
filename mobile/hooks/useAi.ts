import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, streamText } from '@/lib/api';
import type { AiStatus, ChatMessage } from '@/types';

// Is the hub's local AI running, and are its models downloaded? Rechecked every 15 seconds.
export const useAiStatus = () =>
  useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get<AiStatus>('/ai/status'),
    refetchInterval: 15_000,
  });

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
    onError: (_error, history) => setMessages(history), // drop the unfinished reply; the alert shows why
  });

  return {
    messages,
    pending: chat.isPending,
    send: (content: string) => chat.mutate([...messages, { role: 'user', content }]),
    reset: () => setMessages([]),
  };
}
