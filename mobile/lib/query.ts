import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { ApiError } from '@/lib/api';

const showError = (error: Error) => Alert.alert('Something went wrong', error.message);

// Any failed query or mutation shows an alert, so screens don't need their own error handling.
// A 401 on a query means the session ended: clearing "me" sends the user back to /login.
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(['me'], null);
      else showError(error);
    },
  }),
  mutationCache: new MutationCache({ onError: showError }),
  defaultOptions: { queries: { retry: false } },
});
