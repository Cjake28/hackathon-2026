import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api';

// Any failed query or mutation shows a toast, so features don't need their own error handling.
// A 401 on a query means the session ended: clearing "me" sends the user back to /login.
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(['me'], null);
      else toast.error(error.message);
    },
  }),
  mutationCache: new MutationCache({ onError: (error) => toast.error(error.message) }),
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});
