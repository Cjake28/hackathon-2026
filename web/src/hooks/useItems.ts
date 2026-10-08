import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Item } from '@/types';

export const useItems = () =>
  useQuery({ queryKey: ['items'], queryFn: () => api.get<Item[]>('/items') });

export const useCreateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }) => api.post<Item>('/items', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
};

export const useUpdateItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<Item> & { id: number }) =>
      api.patch<Item>(`/items/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
};

// AI example: the API asks the AI to turn a goal into items and saves them.
export const useSuggestItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goal: string) => api.post<Item[]>('/items/suggest', { goal }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
};

export const useDeleteItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<Item>(`/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['items'] }),
  });
};
