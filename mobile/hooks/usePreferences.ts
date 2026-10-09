import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';

export type BooleanPreference = 'wakeWord' | 'memory' | 'announcements' | 'haptics' | 'notifications';

interface PreferencesState {
  wakeWord: boolean;
  memory: boolean;
  announcements: boolean;
  haptics: boolean;
  notifications: boolean;

  setPreference: (key: BooleanPreference, value: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      wakeWord: true,
      memory: true,
      announcements: true,
      haptics: true,
      notifications: true,

      setPreference: (key, value) => set({ [key]: value } as Partial<PreferencesState>),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: createJSONStorage(() => asyncStorageBackend),
    }
  )
);
