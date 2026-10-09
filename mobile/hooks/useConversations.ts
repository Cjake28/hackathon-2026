import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, streamWithHeader } from '@/lib/api';
import type {
  Conversation,
  ConversationMessage,
  ConversationWithMessages,
  PendingAction,
  Source,
} from '@/types';

// Saved AI chats (per user).
export const useConversations = () =>
  useQuery({ queryKey: ['conversations'], queryFn: () => api.get<Conversation[]>('/conversations') });

export const useConversation = (id?: number) =>
  useQuery({
    queryKey: ['conversation', id],
    queryFn: () => api.get<ConversationWithMessages>(`/conversations/${id}`),
    enabled: !!id,
  });

type Settings = { useDocs?: boolean; useTools?: boolean };

export const useCreateConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Settings) => api.post<Conversation>('/conversations', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
};

export const useUpdateConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Settings & { id: number; title?: string }) =>
      api.patch<Conversation>(`/conversations/${id}`, data),
    onSuccess: (conversation) => {
      qc.setQueryData<ConversationWithMessages>(['conversation', conversation.id], (c) => c && { ...c, ...conversation });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
};

export const useDeleteConversation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/conversations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
};

// Sends a message and streams the reply into the cached conversation (sources first, then the text).
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content, image }: { id: number; content: string; image?: string }) => {
      const edit = (change: (messages: ConversationMessage[]) => ConversationMessage[]) =>
        qc.setQueryData<ConversationWithMessages>(['conversation', id], (c) => ({
          ...(c ?? { id, title: content, useDocs: false, useTools: false, updatedAt: '' }),
          messages: change(c?.messages ?? []),
        }));
      const blank = { image: null, sources: null, action: null, createdAt: new Date().toISOString() };
      // Temporary ids until the server's copy is reloaded.
      edit((m) => [
        ...m,
        { ...blank, id: -1, role: 'user', content, image: image ?? null },
        { ...blank, id: -2, role: 'assistant', content: '' },
      ]);
      const reply = (change: (m: ConversationMessage) => ConversationMessage) =>
        edit((m) => m.map((x) => (x.id === -2 ? change(x) : x)));

      await streamWithHeader<{ sources: Source[]; action?: PendingAction }>(
        `/conversations/${id}/messages`,
        { content, image },
        ({ sources, action }) => reply((x) => ({ ...x, sources, action: action ?? null })),
        (text) => reply((x) => ({ ...x, content: x.content + text })),
      );
    },
    onSettled: (_data, _error, { id }) => {
      qc.invalidateQueries({ queryKey: ['conversation', id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

// Confirm or cancel an action the AI proposed ("Allow app actions"). Data it changed is reloaded.
export function useResolveAction(conversationId?: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, approve }: { messageId: number; approve: boolean }) =>
      api.post(`/conversations/${conversationId}/messages/${messageId}/action`, { approve }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
      qc.invalidateQueries({ queryKey: ['items'] }); // add the query keys your own tools change
    },
  });
}
