import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, streamText } from '@/lib/api';
import type { AskResult, RagDocument } from '@/types';

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
      let header = '';
      let gotSources = false;
      await streamText('/rag/ask', { question }, (text) => {
        if (gotSources) {
          setData((d) => d && { ...d, answer: d.answer + text });
          return;
        }
        header += text;
        const newline = header.indexOf('\n');
        if (newline === -1) return;
        gotSources = true;
        setData({ sources: JSON.parse(header.slice(0, newline)).sources, answer: header.slice(newline + 1) });
      });
    },
  });

  return { mutate: ask.mutate, isPending: ask.isPending, data };
}
