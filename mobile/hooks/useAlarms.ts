import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';
import type { Alarm } from '@/types';

export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
export const WEEKDAYS = [1, 2, 3, 4, 5];

export function describeDays(days: number[]): string {
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && WEEKDAYS.every((day) => days.includes(day))) return 'Weekdays';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return [...days].sort().map((day) => names[day]).join(', ');
}

const SEED_ALARMS: Alarm[] = [
  { id: 'alarm-ana-school', label: 'School', time: '06:15', days: WEEKDAYS, ownerId: 'ana', setById: 'rosa', enabled: true, escalateToId: 'rosa', escalateAfterMins: 10, kind: 'alarm' },
  { id: 'alarm-miguel-school', label: 'School', time: '06:30', days: WEEKDAYS, ownerId: 'miguel', setById: 'rosa', enabled: true, escalateToId: 'rosa', escalateAfterMins: 10, kind: 'alarm' },
  { id: 'alarm-miguel-leave', label: 'Leave for school', time: '07:10', days: WEEKDAYS, ownerId: 'miguel', setById: 'rosa', enabled: true, escalateAfterMins: 0, kind: 'reminder' },
  { id: 'alarm-lola-medicine', label: 'Medicine', time: '08:00', days: [0, 1, 2, 3, 4, 5, 6], ownerId: 'lola', setById: 'rosa', enabled: true, escalateToId: 'rosa', escalateAfterMins: 15, kind: 'reminder' },
  { id: 'alarm-ana-bedtime', label: 'Bedtime', time: '21:30', days: WEEKDAYS, ownerId: 'ana', setById: 'rosa', enabled: true, escalateAfterMins: 0, kind: 'reminder' },
  { id: 'alarm-rosa-gym', label: 'Gym', time: '05:30', days: [2, 4, 6], ownerId: 'rosa', setById: 'rosa', enabled: false, escalateAfterMins: 0, kind: 'alarm' },
];

interface CreateAlarmInput {
  label: string;
  time: string;
  days: number[];
  ownerId: string;
  setById: string;
  escalateToId?: string;
  kind?: Alarm['kind'];
}

interface AlarmsState {
  alarms: Alarm[];
  hasHydrated: boolean;

  createAlarm: (input: CreateAlarmInput) => string;
  toggleAlarm: (id: string) => void;
  updateAlarm: (id: string, patch: Partial<Omit<Alarm, 'id'>>) => void;
  deleteAlarm: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAlarmsStore = create<AlarmsState>()(
  persist(
    (set) => ({
      alarms: SEED_ALARMS,
      hasHydrated: false,

      createAlarm: ({ label, time, days, ownerId, setById, escalateToId, kind }) => {
        const id = `alarm-${Date.now()}`;
        set((state) => ({
          alarms: [
            {
              id,
              label: label.trim(),
              time,
              days,
              ownerId,
              setById,
              enabled: true,
              escalateToId,
              kind: kind ?? 'alarm',
              escalateAfterMins: escalateToId ? 10 : 0,
            },
            ...state.alarms,
          ],
        }));
        return id;
      },

      toggleAlarm: (id) =>
        set((state) => ({
          alarms: state.alarms.map((alarm) => (alarm.id === id ? { ...alarm, enabled: !alarm.enabled } : alarm)),
        })),

      updateAlarm: (id, patch) =>
        set((state) => ({
          alarms: state.alarms.map((alarm) => (alarm.id === id ? { ...alarm, ...patch } : alarm)),
        })),

      deleteAlarm: (id) => set((state) => ({ alarms: state.alarms.filter((alarm) => alarm.id !== id) })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEYS.alarms,
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (state) => ({ alarms: state.alarms }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          useAlarmsStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
      },
    }
  )
);

function minutesOf(time: string): number {
  const [hours, mins] = time.split(':').map(Number);
  return (hours || 0) * 60 + (mins || 0);
}

export function sortAlarms(alarms: Alarm[]): Alarm[] {
  return [...alarms].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    return minutesOf(a.time) - minutesOf(b.time);
  });
}

export function formatTime(time: string): string {
  const [hours, mins] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(mins).padStart(2, '0')} ${suffix}`;
}
