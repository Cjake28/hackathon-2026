import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';

export type BooleanPreference =
  | 'wakeWord'
  | 'memory'
  | 'announcements'
  | 'haptics'
  | 'notifications'
  | 'shareLocation';

interface PreferencesState {
  wakeWord: boolean;
  memory: boolean;
  announcements: boolean;
  haptics: boolean;
  notifications: boolean;
  shareLocation: boolean;

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
      shareLocation: false, // off until the person turns it on

      setPreference: (key, value) => set({ [key]: value } as Partial<PreferencesState>),
    }),
    {
      name: STORAGE_KEYS.preferences,
      storage: createJSONStorage(() => asyncStorageBackend),
    }
  )
);
