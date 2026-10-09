import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api } from '@/lib/api';
import type { Permission, User } from '@/types';

// The logged-in user, or null when logged out.
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: () =>
      api.get<User>('/auth/me').catch((error) => {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }),
    staleTime: Infinity,
  });

// const can = useCan(); can('items.delete') → true if the user's role has that permission.
export const useCan = () => {
  const { data: user } = useMe();
  return (permission: Permission) =>
    !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
};

// Any call that logs the user in returns { user, token }. Web only needs the user;
// the session itself is the httpOnly cookie (the token is for mobile).
function useSignIn<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => api.post<{ user: User; token: string }>(path, data),
    onSuccess: ({ user }) => qc.setQueryData(['me'], user),
  });
}

export const useLogin = () => useSignIn<{ email: string; password: string }>('/auth/login');
export const useRegister = () =>
  useSignIn<{ name: string; email: string; password: string }>('/auth/register');

// Full page load after logout so nothing cached from this user survives.
export const useLogout = () =>
  useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => window.location.assign('/login'),
  });
