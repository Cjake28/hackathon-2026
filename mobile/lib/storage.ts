import AsyncStorage from '@react-native-async-storage/async-storage';

// Zustand `persist` storage backend over AsyncStorage. Only the phone's own bits live
// here now (this phone's preferences, the network demo); everything else is on the hub.
export const asyncStorageBackend = {
  getItem: (key: string) => AsyncStorage.getItem(key),
  setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
  removeItem: (key: string) => AsyncStorage.removeItem(key),
};

export const STORAGE_KEYS = {
  network: 'nova:network',
  preferences: 'nova:preferences',
} as const;
