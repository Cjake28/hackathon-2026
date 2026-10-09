import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fileToBase64, streamText } from '@/lib/api';
import type { AskResult, RagDocument } from '@/types';

// RAG: the documents the AI answers from.
export const useDocuments = () =>
  useQuery({ queryKey: ['documents'], queryFn: () => api.get<RagDocument[]>('/rag/documents') });

export const useUploadDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) =>
      api.post<RagDocument & { chunks: number }>('/rag/documents', {
        filename: file.name,
        data: await fileToBase64(file),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
};

export const useDeleteDocument = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/rag/documents/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents'] }),
  });
};

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
