import AsyncStorage from '@react-native-async-storage/async-storage';

// Zustand `persist` storage backend over AsyncStorage. Every Nova store (family,
// tasks, alarms, network, preferences) persists here — all local, no backend.
export const asyncStorageBackend = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const STORAGE_KEYS = {
  family: 'nova:family',
  tasks: 'nova:tasks',
  alarms: 'nova:alarms',
  network: 'nova:network',
  preferences: 'nova:preferences',
} as const;
