import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';
import type { FamilyMember, RecognitionState, Role } from '@/types';

// Stand-in identity for an unrecognised voice — an unknown speaker resolves to
// this guest rather than to nobody, so a stranger gets the time and nothing else.
export const GUEST: FamilyMember = {
  id: 'guest',
  name: 'Guest',
  role: 'guest',
  accent: 'rose',
  voice: 'none',
  face: 'none',
  home: true,
  points: 0,
  note: 'Not recognised',
};

export const ROOMS = ['Living room', 'Kitchen', "Ana's room", "Miguel's room", 'Garage'] as const;

const SEED_FAMILY: FamilyMember[] = [
  { id: 'rosa', name: 'Rosa', role: 'parent', accent: 'arc', voice: 'enrolled', face: 'enrolled', home: true, room: 'Kitchen', points: 0, note: 'Set up the hub' },
  { id: 'dante', name: 'Dante', role: 'parent', accent: 'azure', voice: 'enrolled', face: 'enrolled', home: false, points: 0, note: 'At work until 6pm' },
  { id: 'ana', name: 'Ana', role: 'child', accent: 'violet', voice: 'enrolled', face: 'learning', home: true, room: "Ana's room", points: 240, note: 'Year 9' },
  { id: 'miguel', name: 'Miguel', role: 'child', accent: 'teal', voice: 'enrolled', face: 'none', home: true, room: 'Living room', points: 125, note: 'Year 6' },
  { id: 'lola', name: 'Lola Pacing', role: 'parent', accent: 'amber', voice: 'learning', face: 'none', home: true, room: 'Living room', points: 0, note: 'Medicine reminders on' },
];

interface FamilyState {
  members: FamilyMember[];
  /** Who the hub thinks is speaking; `null` means an unrecognised voice. */
  speakerId: string | null;
  hasHydrated: boolean;

  setSpeaker: (id: string | null) => void;
  setHome: (id: string, home: boolean) => void;
  setRoom: (id: string, room: string) => void;
  setRole: (id: string, role: Role) => void;
  setRecognition: (id: string, kind: 'voice' | 'face', state: RecognitionState) => void;
  updateMember: (id: string, patch: Partial<FamilyMember>) => void;
  awardPoints: (id: string, points: number) => void;
  setHasHydrated: (value: boolean) => void;
}

function patch(members: FamilyMember[], id: string, change: Partial<FamilyMember>): FamilyMember[] {
  return members.map((member) => (member.id === id ? { ...member, ...change } : member));
}

export const useFamilyStore = create<FamilyState>()(
  persist(
    (set) => ({
      members: SEED_FAMILY,
      speakerId: 'rosa',
      hasHydrated: false,

      setSpeaker: (speakerId) => set({ speakerId }),
      setHome: (id, home) =>
        set((state) => ({
          members: patch(state.members, id, {
            home,
            room: home ? state.members.find((m) => m.id === id)?.room : undefined,
          }),
        })),
      setRoom: (id, room) => set((state) => ({ members: patch(state.members, id, { room }) })),
      setRole: (id, role) => set((state) => ({ members: patch(state.members, id, { role } as Partial<FamilyMember>) })),
      setRecognition: (id, kind, recognitionState) =>
        set((state) => ({ members: patch(state.members, id, { [kind]: recognitionState } as Partial<FamilyMember>) })),
      updateMember: (id, change) => set((state) => ({ members: patch(state.members, id, change) })),
      awardPoints: (id, points) =>
        set((state) => ({
          members: state.members.map((member) =>
            member.id === id ? { ...member, points: member.points + points } : member
          ),
        })),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEYS.family,
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (state) => ({ members: state.members, speakerId: state.speakerId }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          useFamilyStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
      },
    }
  )
);

/** The member the hub currently believes is speaking, or the guest identity. */
export function useSpeaker(): FamilyMember {
  const members = useFamilyStore((state) => state.members);
  const speakerId = useFamilyStore((state) => state.speakerId);
  return members.find((member) => member.id === speakerId) ?? GUEST;
}

export function memberById(members: FamilyMember[], id: string | undefined): FamilyMember {
  return members.find((member) => member.id === id) ?? GUEST;
}
