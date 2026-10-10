import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshControl } from 'react-native';

// Pull down to fetch the latest from the hub: refetches every query the screen is showing.
// Use: const refresher = useRefresher(); ... <ScrollView refreshControl={refresher}>
export function useRefresher() {
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await qc.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  };

  // Brand green (--primary): Android takes colors, iOS takes tintColor.
  return <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#25B15F']} tintColor="#25B15F" />;
}
