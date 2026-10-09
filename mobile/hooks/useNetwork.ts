import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';
import type { BlockCategory, HomeDevice } from '@/types';

export const BLOCK_CATEGORIES: readonly { key: BlockCategory; label: string; examples: string }[] = [
  { key: 'social', label: 'Social media', examples: 'TikTok, Instagram, X' },
  { key: 'games', label: 'Games', examples: 'Roblox, Steam, Epic' },
  { key: 'video', label: 'Video', examples: 'YouTube, Netflix, Twitch' },
  { key: 'adult', label: 'Adult sites', examples: 'Blocked by category' },
  { key: 'shopping', label: 'Shopping', examples: 'Shopee, Lazada, Amazon' },
  { key: 'chat', label: 'Chat apps', examples: 'Discord, Messenger' },
];

const SEED_DEVICES: HomeDevice[] = [
  { id: 'dev-ana-laptop', name: "Ana's laptop", kind: 'laptop', ownerId: 'Ana', online: true, lastSeen: '2026-10-10T09:20:00.000Z', blocked: ['social', 'games'], paused: false },
  { id: 'dev-ana-phone', name: "Ana's phone", kind: 'phone', ownerId: 'Ana', online: true, lastSeen: '2026-10-10T09:22:00.000Z', blocked: ['adult'], paused: false },
  { id: 'dev-miguel-tablet', name: "Ben's tablet", kind: 'tablet', ownerId: 'Ben', online: true, lastSeen: '2026-10-10T09:18:00.000Z', blocked: ['social', 'adult', 'chat'], paused: true },
  { id: 'dev-living-tv', name: 'Living room TV', kind: 'tv', online: true, lastSeen: '2026-10-10T09:05:00.000Z', blocked: [], paused: false },
  { id: 'dev-console', name: 'PlayStation', kind: 'console', ownerId: 'Ben', online: false, lastSeen: '2026-10-09T21:40:00.000Z', blocked: [], paused: false },
  { id: 'dev-rosa-phone', name: "Mom's phone", kind: 'phone', ownerId: 'Mom', online: true, lastSeen: '2026-10-10T09:24:00.000Z', blocked: [], paused: false },
  { id: 'dev-unknown', name: 'Unknown device', kind: 'unknown', online: true, lastSeen: '2026-10-10T08:58:00.000Z', blocked: ['adult'], paused: false, isNew: true },
];

interface NetworkState {
  devices: HomeDevice[];
  hasHydrated: boolean;

  toggleCategory: (deviceId: string, category: BlockCategory) => void;
  setPaused: (deviceId: string, paused: boolean) => void;
  setPausedForOwner: (ownerId: string, paused: boolean) => void;
  claimDevice: (deviceId: string, ownerId: string, name?: string) => void;
  acknowledgeNew: (deviceId: string) => void;
  setHasHydrated: (value: boolean) => void;
}

function patch(devices: HomeDevice[], id: string, change: Partial<HomeDevice>): HomeDevice[] {
  return devices.map((device) => (device.id === id ? { ...device, ...change } : device));
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set) => ({
      devices: SEED_DEVICES,
      hasHydrated: false,

      toggleCategory: (deviceId, category) =>
        set((state) => ({
          devices: state.devices.map((device) => {
            if (device.id !== deviceId) return device;
            const blocked = device.blocked.includes(category)
              ? device.blocked.filter((item) => item !== category)
              : [...device.blocked, category];
            return { ...device, blocked };
          }),
        })),

      setPaused: (deviceId, paused) => set((state) => ({ devices: patch(state.devices, deviceId, { paused }) })),

      setPausedForOwner: (ownerId, paused) =>
        set((state) => ({
          devices: state.devices.map((device) => (device.ownerId === ownerId ? { ...device, paused } : device)),
        })),

      claimDevice: (deviceId, ownerId, name) =>
        set((state) => ({
          devices: patch(state.devices, deviceId, { ownerId, name: name?.trim() || undefined, isNew: false }),
        })),

      acknowledgeNew: (deviceId) => set((state) => ({ devices: patch(state.devices, deviceId, { isNew: false }) })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEYS.network,
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (state) => ({ devices: state.devices }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          useNetworkStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
      },
    }
  )
);

export function sortDevices(devices: HomeDevice[]): HomeDevice[] {
  return [...devices].sort((a, b) => {
    if (Boolean(a.isNew) !== Boolean(b.isNew)) return a.isNew ? -1 : 1;
    if (a.online !== b.online) return a.online ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function describeRules(device: HomeDevice): string {
  if (device.paused) return 'Internet paused';
  if (device.blocked.length === 0) return 'Everything allowed';
  if (device.blocked.length === 1) return '1 group blocked';
  return `${device.blocked.length} groups blocked`;
}
