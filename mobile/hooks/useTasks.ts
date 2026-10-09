import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { useFamilyStore } from '@/hooks/useFamily';
import { asyncStorageBackend, STORAGE_KEYS } from '@/lib/storage';
import type { FamilyTask, TaskKind, TaskStatus } from '@/types';

/** No vision model here — the check alternates pass/fail to show both branches. */
const VISION_CHECK_MS = 2200;

const SAMPLE_CAPTURES = {
  kitchenBefore: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=640&q=70',
  kitchenAfter: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=640&q=70',
  roomBefore: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=640&q=70',
  roomAfter: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=640&q=70',
} as const;

export const CHORE_FEEDBACK = {
  pass: [
    'Sink is clear, counters wiped, bin taken out. That’s done.',
    'Bed made, floor clear, clothes in the basket. Nice job.',
  ],
  fail: [
    'Sink is clear, but there are still two pans on the hob and the bin hasn’t gone out.',
    'Floor’s tidy and the bed’s made, but the clothes are on the chair rather than in the basket.',
  ],
} as const;

const SEED_TASKS: FamilyTask[] = [
  {
    id: 'task-dishes', title: 'Wash up after dinner', detail: 'Sink clear, counters wiped, bin out.',
    kind: 'chore', status: 'submitted', assigneeId: 'ana', assignedById: 'rosa',
    createdAt: '2026-10-10T09:10:00.000Z', due: 'Before 8pm', room: 'Kitchen', points: 30,
    beforePhoto: SAMPLE_CAPTURES.kitchenBefore, afterPhoto: SAMPLE_CAPTURES.kitchenAfter,
  },
  {
    id: 'task-room', title: 'Tidy your room', detail: 'Bed made, floor clear, clothes in the basket.',
    kind: 'chore', status: 'doing', assigneeId: 'miguel', assignedById: 'rosa',
    createdAt: '2026-10-10T08:40:00.000Z', due: 'Before screen time', room: "Miguel's room", points: 25,
    beforePhoto: SAMPLE_CAPTURES.roomBefore,
  },
  {
    id: 'task-bins', title: 'Put the bins out', kind: 'task', status: 'assigned',
    assigneeId: 'miguel', assignedById: 'dante', createdAt: '2026-10-10T07:55:00.000Z', due: 'Tonight', points: 10,
  },
  {
    id: 'task-homework', title: 'Finish the maths worksheet', detail: 'Questions 1 to 12.',
    kind: 'task', status: 'approved', assigneeId: 'ana', assignedById: 'rosa',
    createdAt: '2026-10-09T16:20:00.000Z', points: 20,
  },
];

interface AssignInput {
  title: string;
  detail?: string;
  kind: TaskKind;
  assigneeId: string;
  assignedById: string;
  due?: string;
  room?: string;
  points?: number;
}

interface TasksState {
  tasks: FamilyTask[];
  /** Ids currently being checked, so the UI can show the scan running. */
  checking: string[];
  hasHydrated: boolean;
  checkCursor: number;

  assign: (input: AssignInput) => string;
  start: (id: string) => void;
  submit: (id: string) => void;
  review: (id: string) => void;
  approveManually: (id: string) => void;
  remove: (id: string) => void;
  setHasHydrated: (value: boolean) => void;
}

function patch(tasks: FamilyTask[], id: string, change: Partial<FamilyTask>): FamilyTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, ...change } : task));
}

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: SEED_TASKS,
      checking: [],
      hasHydrated: false,
      checkCursor: 0,

      assign: ({ title, detail, kind, assigneeId, assignedById, due, room, points }) => {
        const id = `task-${Date.now()}`;
        set((state) => ({
          tasks: [
            {
              id,
              title: title.trim(),
              detail: detail?.trim() || undefined,
              kind,
              status: 'assigned',
              assigneeId,
              assignedById,
              createdAt: new Date().toISOString(),
              due,
              room,
              points: points ?? (kind === 'chore' ? 25 : 10),
            },
            ...state.tasks,
          ],
        }));
        return id;
      },

      start: (id) =>
        set((state) => ({
          tasks: patch(state.tasks, id, {
            status: 'doing',
            beforePhoto: state.tasks.find((task) => task.id === id)?.beforePhoto ?? SAMPLE_CAPTURES.roomBefore,
            feedback: undefined,
          }),
        })),

      submit: (id) =>
        set((state) => ({
          tasks: patch(state.tasks, id, {
            status: 'submitted',
            afterPhoto: state.tasks.find((task) => task.id === id)?.afterPhoto ?? SAMPLE_CAPTURES.roomAfter,
          }),
        })),

      review: (id) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task || get().checking.includes(id)) return;

        set((state) => ({ checking: [...state.checking, id] }));

        setTimeout(() => {
          const cursor = get().checkCursor;
          const passed = cursor % 2 === 0;
          const pool = passed ? CHORE_FEEDBACK.pass : CHORE_FEEDBACK.fail;
          const feedback = pool[cursor % pool.length];

          set((state) => ({
            checkCursor: state.checkCursor + 1,
            checking: state.checking.filter((item) => item !== id),
            tasks: patch(state.tasks, id, { status: passed ? 'approved' : 'rejected', feedback }),
          }));

          if (passed) useFamilyStore.getState().awardPoints(task.assigneeId, task.points);
        }, VISION_CHECK_MS);
      },

      approveManually: (id) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task || task.status === 'approved') return;

        set((state) => ({ tasks: patch(state.tasks, id, { status: 'approved', feedback: undefined }) }));
        useFamilyStore.getState().awardPoints(task.assigneeId, task.points);
      },

      remove: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: STORAGE_KEYS.tasks,
      storage: createJSONStorage(() => asyncStorageBackend),
      partialize: (state) => ({ tasks: state.tasks }),
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) {
          useTasksStore.getState().setHasHydrated(true);
          return;
        }
        state.setHasHydrated(true);
      },
    }
  )
);

/** Tasks still needing someone to do something, newest first. */
export function openTasks(tasks: FamilyTask[]): FamilyTask[] {
  const OPEN: TaskStatus[] = ['assigned', 'doing', 'submitted', 'rejected'];
  return tasks.filter((task) => OPEN.includes(task.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  assigned: 'Not started',
  doing: 'In progress',
  submitted: 'Waiting to be checked',
  approved: 'Done',
  rejected: 'Needs another go',
};
