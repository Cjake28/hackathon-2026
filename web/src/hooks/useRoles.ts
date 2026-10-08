import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Role } from '@/types';

export const useRoles = () =>
  useQuery({ queryKey: ['roles'], queryFn: () => api.get<Role[]>('/roles') });

// Role changes can change the current user's permissions, so "me" is refreshed too.
function useRoleMutation<T>(mutationFn: (data: T) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export const useCreateRole = () =>
  useRoleMutation((data: { name: string; permissions: string[] }) => api.post<Role>('/roles', data));

export const useUpdateRole = () =>
  useRoleMutation(({ id, ...data }: { id: number; name?: string; permissions?: string[] }) =>
    api.patch<Role>(`/roles/${id}`, data),
  );

export const useDeleteRole = () => useRoleMutation((id: number) => api.delete<Role>(`/roles/${id}`));
