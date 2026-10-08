import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, fileToBase64 } from '@/lib/api';
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

export const useAsk = () =>
  useMutation({ mutationFn: (question: string) => api.post<AskResult>('/rag/ask', { question }) });
