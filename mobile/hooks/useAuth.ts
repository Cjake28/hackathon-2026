import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, api, token } from '@/lib/api';
import type { Permission, User } from '@/types';

// The logged-in user, or null when logged out.
export const useMe = () =>
  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      if (!(await token.get())) return null;
      return api.get<User>('/auth/me').catch(async (error) => {
        if (!(error instanceof ApiError && error.status === 401)) throw error;
        await token.clear();
        return null;
      });
    },
    staleTime: Infinity,
  });

// const can = useCan(); can('items.delete') → true if the user's role has that permission.
export const useCan = () => {
  const { data: user } = useMe();
  return (permission: Permission) =>
    !!user && (user.permissions.includes('*') || user.permissions.includes(permission));
};

// Any call that logs the user in returns { user, token }: keep the token, store the user as "me".
function useSignIn<T>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: T) => api.post<{ user: User; token: string }>(path, data),
    onSuccess: async (session) => {
      await token.set(session.token);
      qc.setQueryData(['me'], session.user);
    },
  });
}

export const useLogin = () => useSignIn<{ email: string; password: string }>('/auth/login');
export const useVerifyEmail = () => useSignIn<{ email: string; code: string }>('/auth/verify-email');
export const useGoogleSignIn = () => useSignIn<{ credential: string }>('/auth/google');

// Sign-up step 1: emails a 6-digit code. Step 2 is useVerifyEmail.
export const useRegister = () =>
  useMutation({
    mutationFn: (data: { name: string; email: string; password: string }) =>
      api.post<{ email: string }>('/auth/register', data),
  });

export const useResendCode = () =>
  useMutation({
    mutationFn: (email: string) => api.post<{ email: string }>('/auth/resend-code', { email }),
  });

export const useLogout = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout').catch(() => null);
      await token.clear();
    },
    onSuccess: () => {
      qc.setQueryData(['me'], null);
      qc.removeQueries({ predicate: (query) => query.queryKey[0] !== 'me' });
    },
  });
};
