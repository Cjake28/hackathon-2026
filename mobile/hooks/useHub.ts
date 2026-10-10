import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiError, api } from '@/lib/api';
import type {
  BudgetSummary,
  Expense,
  GoogleCalendar,
  HubEvent,
  HubAlarm,
  HubNotice,
  HubTask,
  MemoryNote,
  Person,
  Place,
  Points,
  Poll,
  RoleRow,
  User,
  VoiceReply,
  Whereabouts,
} from '@/types';

// Everything the app reads and changes on the hub (TEAM-PLAN.md 4.5). The data lives on the hub, not on the phone.

// ---- Device poll: the hub's "push" ----
// Every 3 s: new notices (each handled once), my ringing alarms, who's home.
// It's also the heartbeat: a phone polling over the home Wi-Fi counts as "home".

const EMPTY_POLL: Poll = { cursor: 0, notices: [], ringing: [], home: [] };

// Which lists to refresh when a notice arrives.
const REFRESH: Partial<Record<HubNotice['kind'], string[]>> = {
  'alarm:ring': ['alarms'],
  'task:new': ['tasks'],
  'task:reviewed': ['tasks', 'points'],
  'presence:arrived': ['family'],
  'presence:left': ['family'],
  'event:soon': ['events'],
};

export function useDevicePoll(onNotice: (notice: HubNotice) => void) {
  const qc = useQueryClient();
  const cursor = useRef(0);
  const handle = useRef(onNotice);
  handle.current = onNotice;
  return useQuery({
    queryKey: ['poll'],
    refetchInterval: 3000,
    queryFn: async () => {
      const poll = await api.get<Poll>(`/device/poll${cursor.current ? `?after=${cursor.current}` : ''}`).catch((error) => {
        // Logged out: the 401 sends the app back to login. Hub unreachable for a moment: keep polling quietly
        // (no "Something went wrong" alert every 3 s) and keep showing what we had.
        if (error instanceof ApiError && error.status === 401) throw error;
        return null;
      });
      if (!poll) return qc.getQueryData<Poll>(['poll']) ?? EMPTY_POLL;
      cursor.current = poll.cursor;
      for (const notice of poll.notices) {
        if (notice.kind === 'voice:heard') {
          qc.setQueryData<HubNotice[]>(['heard'], (old = []) => [notice, ...old].slice(0, 20));
        }
        for (const key of REFRESH[notice.kind] ?? []) qc.invalidateQueries({ queryKey: [key] });
        handle.current(notice);
      }
      return poll;
    },
  });
}

// "Onai heard…" for the parent's screen: the last 20 things Onai heard (filled by the poll).
// notice.data = { speaker, confidence, reply }
export const useHeard = () =>
  useQuery<HubNotice[]>({ queryKey: ['heard'], queryFn: () => [], initialData: [], staleTime: Infinity });

// ---- Family / who's home ----

export const useHubFamily = () => useQuery({ queryKey: ['family'], queryFn: () => api.get<Person[]>('/family') });

// ---- Alarms and reminders ----

// Mine by default. A parent can pass { userId } (one kid) or { all: true } (everyone).
export const useHubAlarms = (filter: { userId?: number; all?: boolean } = {}) =>
  useQuery({
    queryKey: ['alarms', filter],
    queryFn: () =>
      api.get<HubAlarm[]>(`/alarms${filter.all ? '?all=1' : filter.userId ? `?userId=${filter.userId}` : ''}`),
  });

// userId: someone else's alarm (parents only). Use time "06:30" OR inMinutes (rings exactly N minutes from now).
export type AlarmInput = {
  userId?: number;
  kind?: 'alarm' | 'reminder';
  label?: string;
  time?: string;
  inMinutes?: number;
  repeat?: 'once' | 'daily' | 'weekdays';
};

export const useCreateAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: AlarmInput) => api.post<HubAlarm>('/alarms', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms'] }),
  });
};

// A child changing an alarm a parent set gets the hub's alert: only a parent can remove it.
export const useUpdateAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: number } & Pick<AlarmInput, 'label' | 'time' | 'repeat'> & { enabled?: boolean }) =>
      api.patch<HubAlarm>(`/alarms/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms'] }),
  });
};

export const useDeleteAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<HubAlarm>(`/alarms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alarms'] }),
  });
};

// Ana may dismiss or snooze her alarm even when Mom set it.
export const useDismissAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<HubAlarm>(`/alarms/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['poll'] });
      qc.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
};

export const useSnoozeAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.post<HubAlarm>(`/alarms/${id}/snooze`, { minutes: 5 }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['poll'] });
      qc.invalidateQueries({ queryKey: ['alarms'] });
    },
  });
};

// ---- Tasks and chores ----

// Mine by default. A parent passes true to see everyone's (who finished what).
export const useHubTasks = (all = false) =>
  useQuery({ queryKey: ['tasks', all], queryFn: () => api.get<HubTask[]>(`/tasks${all ? '?all=1' : ''}`) });

// Parents only. The kid's phone pops up "New task" and the hub says it out loud.
export const useCreateTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      assigneeId: number;
      isChore?: boolean;
      checklist?: string[];
      dueAt?: string;
    }) => api.post<HubTask>('/tasks', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
};

// Ana checks a task or chore off when she's finished. No photo. Mom and Dad get "Ana finished: Wash the dishes"
// and see it done; a done chore is +10 points. done: false unchecks it.
export const useSetTaskDone = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      api.patch<HubTask>(`/tasks/${id}`, { status: done ? 'done' : 'pending' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['points'] });
    },
  });
};

export const useDeleteTask = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<HubTask>(`/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
};

// ---- Talk to Onai (typed; also the stage backup if the mic fails) ----
// reply.pending = Onai asks "… Say yes to confirm": send "yes" (or "no") as the next text.
export const useTalk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post<VoiceReply>('/voice/text', { text }),
    // Onai may have changed something: refresh the lists.
    onSuccess: () => {
      for (const key of ['alarms', 'tasks', 'items', 'points', 'memory', 'events', 'expenses', 'budget'])
        qc.invalidateQueries({ queryKey: [key] });
    },
  });
};

// ---- Extras ----

// Leaderboard, most points first. 10 points per finished chore.
export const usePoints = () => useQuery({ queryKey: ['points'], queryFn: () => api.get<Points[]>('/points') });

// "Good morning" button: Onai's short summary of my day (alarms, events, tasks, grocery list).
export const useBriefing = () => useMutation({ mutationFn: () => api.get<{ text: string }>('/briefing') });

// "What Onai remembers about me" (only my own notes), with delete.
export const useMemory = () => useQuery({ queryKey: ['memory'], queryFn: () => api.get<MemoryNote[]>('/memory') });

export const useDeleteMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<MemoryNote>(`/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
  });
};

// ---- Calendar (calendar.use) ----
// From today on, soonest first. Onai adds these by voice too ("piano on Saturday at 4").

export const useEvents = () =>
  useQuery({ queryKey: ['events'], queryFn: () => api.get<HubEvent[]>('/events') });

export const useCreateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    // startsAt is a full ISO date-time. userId left out = the whole family.
    mutationFn: (data: { title: string; startsAt: string; userId?: number | null }) =>
      api.post<HubEvent>('/events', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};

// Move (startsAt), rename (title) or change whose it is (userId). Whoever added it, or a parent.
export const useUpdateEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; title?: string; startsAt?: string; userId?: number | null }) =>
      api.patch<HubEvent>(`/events/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};

// Whoever added it, or a parent. Anyone else gets the hub's alert:
// "Mom added that event, so only a parent can change it."
export const useDeleteEvent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<HubEvent>(`/events/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
};


// ---- Google Calendar (calendar.use): a copy of your events in your own Google Calendar ----
// Events are saved on the hub first, so the calendar still works with the internet off (docs/google-calendar.md).

export const useGoogleCalendar = () =>
  useQuery({ queryKey: ['google'], queryFn: () => api.get<GoogleCalendar>('/google') });

// Step 1: your Gmail → the hub drops a one-time code inside that calendar. '' disconnects.
export const useConnectMyCalendar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (calendarId: string) => api.patch<GoogleCalendar>('/google/me', { calendarId }),
    onSuccess: (data) => qc.setQueryData(['google'], data),
  });
};

// Step 2: the code from the "Jarvis code" event in that calendar.
export const useVerifyMyCalendar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => api.patch<GoogleCalendar>('/google/me/verify', { code }),
    onSuccess: (data) => {
      qc.setQueryData(['google'], data);
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// Parents only (users.manage): the shared "Family" calendar for events that belong to nobody in particular.
export const useConnectFamilyCalendar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (calendarId: string) => api.patch<GoogleCalendar>('/google/family', { calendarId }),
    onSuccess: (data) => {
      qc.setQueryData(['google'], data);
      qc.invalidateQueries({ queryKey: ['events'] });
    },
  });
};

// ---- Budget (budget.use) ----
// The month's total, the limit the hub keeps, and the split per category.

export const useExpenses = () =>
  useQuery({ queryKey: ['expenses'], queryFn: () => api.get<Expense[]>('/expenses') });

export const useBudgetSummary = () =>
  useQuery({ queryKey: ['budget'], queryFn: () => api.get<BudgetSummary>('/expenses/summary') });

export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { amount: number; category?: string; note?: string }) =>
      api.post<Expense>('/expenses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
};

export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<Expense>(`/expenses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['budget'] });
    },
  });
};

// ---- Where everyone is (#51) and the places that count as somewhere (#52) ----
// Only parents (location.read) see this. The phone sends its own position with useShareLocation (hooks/useLocationShare.ts).

export const useWhereabouts = () =>
  useQuery({ queryKey: ['whereabouts'], queryFn: () => api.get<Whereabouts[]>('/location'), refetchInterval: 15000 });

export const usePlaces = () => useQuery({ queryKey: ['places'], queryFn: () => api.get<Place[]>('/places') });

export const useAddPlace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; lat: number; lng: number; radiusM?: number }) =>
      api.post<Place>('/places', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['places'] });
      qc.invalidateQueries({ queryKey: ['whereabouts'] });
    },
  });
};

export const useDeletePlace = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<Place>(`/places/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['places'] });
      qc.invalidateQueries({ queryKey: ['whereabouts'] });
    },
  });
};

// ---- Family accounts, roles and permissions (parents only: users.manage, roles.manage) ----
// No sign-up and no Google: Mom or Dad makes every account here and picks its role. "email" is just the login
// name ("ana" works too). Password: 6+ characters.

export const useUsers = () => useQuery({ queryKey: ['users'], queryFn: () => api.get<User[]>('/users') });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; email: string; password: string; roleId: number }) =>
      api.post<User>('/users', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['family'] });
    },
  });
};

// Change name, login or role, or set a new password ({ id, password }). Your own role can't be changed.
export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; email?: string; password?: string; roleId?: number }) =>
      api.patch<User>(`/users/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['family'] });
    },
  });
};

// Also deletes their alarms, tasks and notes. You can't delete yourself or Guest (Onai uses it for unknown voices).
export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<User>(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['family'] });
    },
  });
};

export const useRoles = () => useQuery({ queryKey: ['roles'], queryFn: () => api.get<RoleRow[]>('/roles') });

// Every permission there is (for the role editor's checkboxes).
export const usePermissionList = () =>
  useQuery({ queryKey: ['permissions'], queryFn: () => api.get<string[]>('/roles/permissions'), staleTime: Infinity });

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; permissions: string[] }) => api.post<RoleRow>('/roles', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
};

// Takes effect right away for everyone with that role (no re-login). Your own role can't be changed.
export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; permissions?: string[] }) =>
      api.patch<RoleRow>(`/roles/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

// Only a role nobody has (move its people to another role first).
export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<RoleRow>(`/roles/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });
};
