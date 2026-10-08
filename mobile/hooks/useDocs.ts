import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AskResult, RagDocument } from '@/types';

// RAG: documents are uploaded from the web app (or `npm run rag:ingest`); mobile asks questions.
export const useDocuments = () =>
  useQuery({ queryKey: ['documents'], queryFn: () => api.get<RagDocument[]>('/rag/documents') });

export const useAsk = () =>
  useMutation({ mutationFn: (question: string) => api.post<AskResult>('/rag/ask', { question }) });
