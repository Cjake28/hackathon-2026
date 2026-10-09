import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, streamWithHeader } from '@/lib/api';
import type { AskResult, RagDocument, Source } from '@/types';

// RAG: documents are uploaded from the web app (or `npm run rag:ingest`); mobile asks questions.
export const useDocuments = () =>
  useQuery({ queryKey: ['documents'], queryFn: () => api.get<RagDocument[]>('/rag/documents') });

// Ask the documents. The sources arrive first, then the answer streams in piece by piece:
// the response's first line is JSON { sources }, the rest is the answer text.
export function useAsk() {
  const [data, setData] = useState<AskResult | null>(null);

  const ask = useMutation({
    mutationFn: async (question: string) => {
      setData(null);
      await streamWithHeader<{ sources: Source[] }>(
        '/rag/ask',
        { question },
        ({ sources }) => setData({ sources, answer: '' }),
        (text) => setData((d) => d && { ...d, answer: d.answer + text }),
      );
    },
  });

  return { mutate: ask.mutate, isPending: ask.isPending, data };
}
