# Mobile ↔ Hub: connecting the app

**For Vincent (mobile).** Right now the app keeps everything on the phone (Zustand + AsyncStorage) and pretends to be
Jarvis. This guide connects it to the hub, so that:

- the alarm Mom sets **rings on Ana's phone**,
- a new task **pops up** on the kid's phone,
- Ana **checks off** a chore and Mom/Dad see it's done,
- Jarvis answers for real.

The design stays yours: you only swap where the data comes from.

**Every file below was typechecked against the current `mobile/` (`tsc` passes).** The hub endpoints are live on `main`.
Copy the files as they are, then wire your screens (section 6).

```
Phone (Expo app)                                Hub laptop (http://<hub-ip>:4101/api)
────────────────                                ─────────────────────────────────────
login.tsx ── POST /auth/login ────────────────▶ token (SecureStore) → sent with every request
HubListener ── GET /device/poll every 3 s ───▶ { notices, ringing, home }
   ringing[] not empty → full-screen alarm ───▶ POST /alarms/:id/dismiss | /snooze
   notice task:new → "New task" popup
screens ── hooks/useHub.ts ───────────────────▶ /alarms /tasks /family /voice/text /points …
```

---

## 1. Setup

1. The phone and the hub laptop are on **the same Wi-Fi**. Install **Expo Go** on the demo phones.
2. `mobile/.env`:
   ```
   EXPO_PUBLIC_API_URL=http://<hub laptop IP>:4101/api
   ```
   The hub prints its IP when it starts: `API on the local network: http://192.168.x.x:4101/api`. Without this line
   the app uses the computer running `expo start`, which is only right if that computer is the hub.
   Away from home (over the internet): see section 12 (Hub address + Cloudflare tunnel).
3. On the hub laptop: Windows Firewall → allow Node.js on **Private** networks.
4. Accounts (from `npm run db:seed`, password `family123`): `mom@family.local`, `dad@family.local` (parents),
   `ana@family.local`, `ben@family.local` (kids). Mom and Dad can make more accounts in the app (section 8).

## 2. Types: add to the end of `mobile/types.ts`

The hub's JSON shapes. They're called `Hub…` so they don't clash with your local `Alarm` / `Role` types.

```ts
// ---- Hub API (TEAM-PLAN.md 4.4). "Hub" names so they don't clash with the local Nova types above. ----
export type HubRole = 'admin' | 'parent' | 'child' | 'guest';
export type Person = { id: number; name: string; role: HubRole; isHome: boolean; lastSeenAt: string | null };
export type HubAlarm = {
  id: number;
  userId: number; // who it rings for
  createdById: number; // who set it (a child can't delete or turn off an alarm a parent set)
  kind: 'alarm' | 'reminder';
  label: string;
  time: string; // "06:30", 24h, hub time
  repeat: 'once' | 'daily' | 'weekdays';
  nextAt: string;
  enabled: boolean;
  ringingAt: string | null; // set while it rings
};
export type HubTask = {
  id: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  createdById: number;
  isChore: boolean;
  checklist: string[]; // what "done" looks like
  dueAt: string | null;
  status: 'pending' | 'redo' | 'done';
  beforePhoto: string | null; // unused: chores have no photos
  afterPhoto: string | null;
  feedback: string | null;
  createdAt: string;
  doneAt: string | null;
};
export type NoticeKind =
  | 'alarm:ring'
  | 'task:new'
  | 'task:reviewed'
  | 'presence:arrived'
  | 'presence:left'
  | 'voice:heard'
  | 'intercom'
  | 'alarm:ignored'; // parents: a kid's alarm rang 2 min with no dismiss
export type HubNotice = {
  id: number;
  toUserId: number | null; // null = every device
  kind: NoticeKind;
  text: string;
  data: any;
  createdAt: string;
};
export type Poll = { cursor: number; notices: HubNotice[]; ringing: HubAlarm[]; home: Person[] };
export type VoiceReply = { reply: string; speaker: { id: number; name: string; role: HubRole }; pending: boolean };
export type Points = { userId: number; name: string; points: number; choresDone: number };
export type MemoryNote = { id: number; userId: number; text: string; createdAt: string };
// A role as GET /roles returns it (parents edit these). Family accounts use the existing `User` type above.
export type RoleRow = { id: number; name: string; permissions: string[]; _count: { users: number } };
```

## 3. Login: no sign-up, no Google

**Mom or Dad makes every account** (section 8). Everyone else just logs in. The hub must know whose phone it is:
Ana's phone rings for Ana's alarms, and a kid can't delete an alarm Mom set. `POST /auth/register` now answers
403 "Ask Mom or Dad to make your account."

1. Bring back the boilerplate's auth hooks (`useMe`, `useCan`, `useLogin`, `useLogout`):
   ```
   git checkout e26426e -- mobile/hooks/useAuth.ts
   ```
2. New file `mobile/app/login.tsx`:
   ```tsx
   import { Redirect } from 'expo-router';
   import { useState } from 'react';
   import { Pressable, View } from 'react-native';
   import { Input } from '@/components/ui/input';
   import { Text } from '@/components/ui/text';
   import { useLogin, useMe } from '@/hooks/useAuth';

   // There's no sign-up: Mom or Dad makes every account (app/(app)/accounts.tsx). The hub needs to know whose phone
   // this is: Ana's phone rings for Ana's alarms, and a child can't delete the alarm Mom set.
   export default function LoginScreen() {
     const { data: me } = useMe();
     const login = useLogin();
     const [email, setEmail] = useState('');
     const [password, setPassword] = useState('');
     if (me) return <Redirect href="/" />;

     const submit = () => login.mutate({ email, password });

     return (
       <View className="flex-1 justify-center gap-4 bg-background p-6">
         <Text variant="h3">Log in</Text>
         <Text variant="muted">Mom or Dad makes your account. Ask them for your login.</Text>
         <Input
           testID="login-email"
           placeholder="Login (e.g. ana or ana@family.local)"
           autoCapitalize="none"
           value={email}
           onChangeText={setEmail}
         />
         <Input
           testID="login-password"
           placeholder="Password"
           secureTextEntry
           value={password}
           onChangeText={setPassword}
           onSubmitEditing={submit}
         />
         <Pressable testID="login-submit" disabled={login.isPending} onPress={submit} className="rounded-3xl bg-primary p-4">
           <Text variant="large" className="text-center text-primary-foreground">
             Log in
           </Text>
         </Pressable>
       </View>
     );
   }
   ```
3. Replace `mobile/app/(app)/_layout.tsx`. It sends logged-out phones to `/login`, starts the `HubListener`, and adds
   the two parent screens:
   ```tsx
   import { Redirect, Stack } from 'expo-router';
   import { HubListener } from '@/components/HubListener';
   import { useMe } from '@/hooks/useAuth';

   // Logged in only: the hub needs to know whose phone this is (app/login.tsx). The tab navigator lives in
   // (tabs)/_layout.tsx; this Stack adds the pushes and modals on top. HubListener polls the hub and shows ringing alarms.
   export default function AppLayout() {
     const { data: me, isPending } = useMe();
     if (isPending) return null;
     if (!me) return <Redirect href="/login" />;

     return (
       <>
         <Stack screenOptions={{ headerShown: false }}>
           <Stack.Screen name="(tabs)" />
           <Stack.Screen name="talk" />
           <Stack.Screen name="task/[id]" />
           <Stack.Screen name="member/[id]" />
           <Stack.Screen name="device/[id]" />
           <Stack.Screen name="network" />
           <Stack.Screen name="roadmap" options={{ presentation: 'modal' }} />
           <Stack.Screen name="personal-info" options={{ presentation: 'modal' }} />
           <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
           <Stack.Screen name="accounts" />
           <Stack.Screen name="roles" />
         </Stack>
         <HubListener />
       </>
     );
   }
   ```
4. Somewhere in Settings: a **"Switch person"** button → `const logout = useLogout(); logout.mutate()`.

## 4. All hub calls: new file `mobile/hooks/useHub.ts`

Same pattern as `hooks/useItems.ts` (TanStack Query). Errors already show an alert (`lib/query.ts`), and a 401 goes
back to login, so screens don't need their own error handling.

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { ApiError, api } from '@/lib/api';
import type { HubAlarm, HubNotice, HubTask, MemoryNote, Person, Points, Poll, RoleRow, User, VoiceReply } from '@/types';

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
      const poll = await api
        .get<Poll>(`/device/poll${cursor.current ? `?after=${cursor.current}` : ''}`)
        .catch((error) => {
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

// "Jarvis heard…" for the parent's screen: the last 20 things Jarvis heard (filled by the poll).
// notice.data = { speaker, confidence, reply }
export const useHeard = () =>
  useQuery<HubNotice[]>({ queryKey: ['heard'], queryFn: () => [], initialData: [], staleTime: Infinity });

// ---- Family / who's home ----

export const useHubFamily = () =>
  useQuery({ queryKey: ['family'], queryFn: () => api.get<Person[]>('/family') });

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

// A child changing an alarm a parent set gets an alert: "Mom set that alarm, so only a parent can remove it."
export const useUpdateAlarm = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Pick<AlarmInput, 'label' | 'time' | 'repeat'> & { enabled?: boolean }) =>
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
    mutationFn: (data: { title: string; assigneeId: number; isChore?: boolean; checklist?: string[]; dueAt?: string }) =>
      api.post<HubTask>('/tasks', data),
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

// ---- Talk to Jarvis (typed; also the stage backup if the mic fails) ----
// reply.pending = Jarvis asks "… Say yes to confirm": send "yes" (or "no") as the next text.
export const useTalk = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.post<VoiceReply>('/voice/text', { text }),
    // Jarvis may have changed something: refresh the lists.
    onSuccess: () => {
      for (const key of ['alarms', 'tasks', 'items', 'points', 'memory']) qc.invalidateQueries({ queryKey: [key] });
    },
  });
};

// ---- Extras ----

// Leaderboard, most points first. 10 points per finished chore.
export const usePoints = () => useQuery({ queryKey: ['points'], queryFn: () => api.get<Points[]>('/points') });

// "Good morning" button: Jarvis's short summary of my day (alarms, events, tasks, grocery list).
export const useBriefing = () => useMutation({ mutationFn: () => api.get<{ text: string }>('/briefing') });

// "What Jarvis remembers about me" (only my own notes), with delete.
export const useMemory = () => useQuery({ queryKey: ['memory'], queryFn: () => api.get<MemoryNote[]>('/memory') });

export const useDeleteMemory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete<MemoryNote>(`/memory/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['memory'] }),
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

// Also deletes their alarms, tasks and notes. You can't delete yourself or Guest (Jarvis uses it for unknown voices).
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
```

## 5. Poll + full-screen alarm + popups: new file `mobile/components/HubListener.tsx`

Mounted once by the layout in section 3. **This is what makes the alarm ring on Ana's phone.**

```tsx
import { useEffect } from 'react';
import { Alert, Modal, Pressable, Vibration, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { useDevicePoll, useDismissAlarm, useSnoozeAlarm } from '@/hooks/useHub';
import type { HubNotice } from '@/types';

// Mount once in the logged-in layout. Polls the hub every 3 s, pops up new tasks, finished chores and announcements,
// and covers the whole screen while one of my alarms rings, until Dismiss or Snooze.
export function HubListener() {
  const poll = useDevicePoll(showNotice);
  const dismiss = useDismissAlarm();
  const snooze = useSnoozeAlarm();
  const alarm = poll.data?.ringing[0];

  // Buzz until it's dismissed. (For a sound too, see "Alarm sound" in docs/mobile-hub.md.)
  useEffect(() => {
    if (!alarm) return;
    Vibration.vibrate([0, 800, 600], true);
    return () => Vibration.cancel();
  }, [alarm?.id]);

  return (
    <Modal visible={!!alarm} animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 items-center justify-center gap-6 bg-primary p-8">
        <Text className="text-6xl">⏰</Text>
        <Text variant="h3" className="text-center text-primary-foreground">
          {alarm?.label}
        </Text>
        <Text variant="large" className="text-primary-foreground">
          {alarm?.time}
        </Text>
        <Pressable
          testID="alarm-dismiss"
          disabled={dismiss.isPending}
          onPress={() => alarm && dismiss.mutate(alarm.id)}
          className="w-full rounded-3xl bg-background p-5"
        >
          <Text variant="large" className="text-center">
            Dismiss
          </Text>
        </Pressable>
        <Pressable
          testID="alarm-snooze"
          disabled={snooze.isPending}
          onPress={() => alarm && snooze.mutate(alarm.id)}
          className="w-full rounded-3xl border-2 border-primary-foreground p-5"
        >
          <Text variant="large" className="text-center text-primary-foreground">
            Snooze 5 min
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

// Swap Alert for your own banner/toast if you like. Ringing alarms don't need a notice: the poll's `ringing` drives
// the full-screen alarm above.
function showNotice(notice: HubNotice) {
  if (notice.kind === 'task:new') Alert.alert('New task', notice.text); // "Mom: Wash the dishes"
  if (notice.kind === 'task:reviewed') Alert.alert('Task done ✓', notice.text); // parents: "Ana finished: Wash the dishes"
  if (notice.kind === 'alarm:ignored') Alert.alert('⏰ Alarm still ringing', notice.text); // parents: "Ana's alarm has been ringing for 2 minutes."
  if (notice.kind === 'intercom') Alert.alert('📢 Announcement', notice.text); // "Announcement from Mom: dinner's ready"
}
```

## 6. Wire your screens

Swap each local store for the hub hook. Keep your design.

| Screen | Use | Notes |
|---|---|---|
| **Home tab** | `useTalk()`, `useBriefing()`, `useHubFamily()` | "Tap to talk" → `talk.mutate(text)`. "Good morning" button → `briefing.mutate()` → show `data.text` |
| **Tasks tab** | `useHubTasks()` (mine), `useHubTasks(true)` if `can('tasks.assign')` | Checkbox → `useSetTaskDone().mutate({ id, done })`. Points → `usePoints()` |
| **task/[id]** (new task) | `useCreateTask()` + `useHubFamily()` for the "Who's doing it" list | "What finished looks like" → `checklist`. **"How it's checked": only "They just say so"** (remove Camera check, see section 7) |
| **Family tab / member/[id]** | `useHubFamily()` | `isHome`, `lastSeenAt`. The family is Mom, Dad, Ana, Ben (no Miguel) |
| **Alarms tab** | `useHubAlarms()`; parents `useHubAlarms({ all: true })` | Add → `useCreateAlarm({ userId, time: "06:30" or inMinutes, label, repeat })`. Toggle → `useUpdateAlarm({ id, enabled })`. Delete → `useDeleteAlarm()`. A kid touching Mom's alarm gets the hub's alert automatically |
| **talk.tsx** | `useTalk()` | Show `reply`. If `pending` (Jarvis asks "Say yes to confirm"): **Yes** / **No** buttons → `talk.mutate('yes')` / `'no'` |
| **Parent: "Jarvis heard…"** | `useHeard()` | `notice.data.speaker`, `notice.data.reply`; newest first |
| **Grocery** | `hooks/useItems.ts` (already there) | `/items` |
| **Memory** | `useMemory()`, `useDeleteMemory()` | "What Jarvis remembers about me" |
| **Accounts, Roles** (parents) | `app/(app)/accounts.tsx`, `app/(app)/roles.tsx` (section 8) | Link from Settings or the Hub tab, only when `can('users.manage')` |

**Rename "Nova" → "Jarvis"** everywhere: the hub's wake word is "hey jarvis", and the demo says "Hey Jarvis".

## 7. Chores: checked off, no photo (decided)

```
Ana taps the checkbox ──▶ PATCH /tasks/:id { status: "done" } ──▶ Mom's and Dad's phones: "Task done ✓ — Ana finished: Wash the dishes"
                                                                  their Tasks list (useHubTasks(true)): status "done", doneAt
                                                                  Ana: +10 points (usePoints)
Ana unchecks it ────────▶ PATCH /tasks/:id { status: "pending" }
```

No camera, no AI check. Use `useSetTaskDone()` for tasks and chores alike.

## 8. Parent-made accounts, roles and permissions

Mom and Dad (`users.manage`, `roles.manage`) make every account and decide what each role may do. The hub enforces the
rules, and the app just shows its alert:

- You can't delete yourself or change your own role. Your own role's permissions are locked, so you can't lock
  yourself out.
- **Guest** can't be deleted: Jarvis uses it for voices it doesn't know.
- A login that's taken → "already exists". Passwords need 6+ characters. The login can be a plain name ("lola").
- Role changes apply right away, with no re-login.

New file `mobile/app/(app)/accounts.tsx`:

```tsx
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateUser, useDeleteUser, useRoles, useUpdateUser, useUsers } from '@/hooks/useHub';

const chip = (on: boolean) => (on ? 'rounded-full bg-primary px-3 py-1' : 'rounded-full border border-primary px-3 py-1');

// Parents only (users.manage): make an account for each family member and pick its role. There's no sign-up.
export default function AccountsScreen() {
  const can = useCan();
  const { data: me } = useMe();
  const { data: users = [] } = useUsers();
  const { data: roles = [] } = useRoles();
  const create = useCreateUser();
  const update = useUpdateUser();
  const remove = useDeleteUser();
  const [name, setName] = useState('');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);

  if (!can('users.manage')) return <Text className="p-6">Only Mom or Dad can manage accounts.</Text>;

  const add = () =>
    roleId &&
    create.mutate(
      { name, email: login, password, roleId },
      {
        onSuccess: () => {
          setName('');
          setLogin('');
          setPassword('');
        },
      },
    );

  const askDelete = (id: number, who: string) =>
    Alert.alert(`Delete ${who}?`, 'Their alarms, tasks and notes are deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id) },
    ]);

  return (
    <ScrollView contentContainerClassName="gap-4 p-6">
      <Text variant="h3">Family accounts</Text>
      {users.map((u) => (
        <View key={u.id} className="gap-2 rounded-3xl bg-card p-4">
          <Text variant="large">{u.name}</Text>
          <Text variant="muted">Login: {u.email}</Text>
          {/* Tap a role to move them to it. Your own role is locked. */}
          <View className="flex-row flex-wrap gap-2">
            {roles.map((r) => (
              <Pressable
                key={r.id}
                disabled={u.id === me?.id || update.isPending}
                onPress={() => update.mutate({ id: u.id, roleId: r.id })}
                className={chip(r.id === u.roleId)}
              >
                <Text className={r.id === u.roleId ? 'text-sm text-primary-foreground' : 'text-sm'}>{r.name}</Text>
              </Pressable>
            ))}
          </View>
          {u.id !== me?.id && (
            <Pressable testID={`account-delete-${u.id}`} onPress={() => askDelete(u.id, u.name)}>
              <Text className="text-destructive">Delete</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Text variant="label">Add someone</Text>
      <Input testID="account-name" placeholder="Name (e.g. Lola)" value={name} onChangeText={setName} />
      <Input
        testID="account-login"
        placeholder="Login (e.g. lola)"
        autoCapitalize="none"
        value={login}
        onChangeText={setLogin}
      />
      <Input
        testID="account-password"
        placeholder="Password (6+ characters)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View className="flex-row flex-wrap gap-2">
        {roles.map((r) => (
          <Pressable key={r.id} onPress={() => setRoleId(r.id)} className={chip(r.id === roleId)}>
            <Text className={r.id === roleId ? 'text-sm text-primary-foreground' : 'text-sm'}>{r.name}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        testID="account-add"
        disabled={!roleId || create.isPending}
        onPress={add}
        className="rounded-3xl bg-primary p-4"
      >
        <Text variant="large" className="text-center text-primary-foreground">
          Add account
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

New file `mobile/app/(app)/roles.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { useCan, useMe } from '@/hooks/useAuth';
import { useCreateRole, useDeleteRole, usePermissionList, useRoles, useUpdateRole } from '@/hooks/useHub';
import type { RoleRow } from '@/types';

// What each permission lets someone do (names come from GET /roles/permissions).
const LABELS: Record<string, string> = {
  'ai.use': 'Talk to Jarvis',
  'alarms.own': 'Own alarms and reminders',
  'alarms.family': "Set other people's alarms",
  'tasks.own': 'Own tasks and chores',
  'tasks.assign': 'Give tasks to others',
  'presence.read': "See who's home",
  'memory.own': 'Jarvis remembers things about me',
  'intercom.send': 'Announce to everyone',
  'items.read': 'See the grocery list',
  'items.create': 'Add to the grocery list',
  'items.update': 'Check off groceries',
  'items.delete': 'Delete groceries',
  'calendar.use': 'Family calendar',
  'budget.use': 'Family budget',
  'location.share': 'Share my location',
  'location.read': "See everyone's location",
  'users.manage': 'Make and delete accounts',
  'roles.manage': 'Edit roles and permissions',
  'docs.manage': 'Manage documents',
  'ai.manage': "Pick the hub's AI model",
};

const chip = (on: boolean) => (on ? 'rounded-full bg-primary px-3 py-1' : 'rounded-full border border-primary px-3 py-1');

// Parents only (roles.manage): make roles (e.g. "grandparent", "yaya") and tap permissions on/off.
// Changes apply right away to everyone with that role. Your own role is locked so you can't lock yourself out.
export default function RolesScreen() {
  const can = useCan();
  const { data: me } = useMe();
  const { data: roles = [] } = useRoles();
  const { data: permissions = [] } = usePermissionList();
  const create = useCreateRole();
  const update = useUpdateRole();
  const remove = useDeleteRole();
  const [name, setName] = useState('');

  if (!can('roles.manage')) return <Text className="p-6">Only Mom or Dad can edit roles.</Text>;

  const toggle = (role: RoleRow, permission: string) =>
    update.mutate({
      id: role.id,
      permissions: role.permissions.includes(permission)
        ? role.permissions.filter((p) => p !== permission)
        : [...role.permissions, permission],
    });

  return (
    <ScrollView contentContainerClassName="gap-4 p-6">
      <Text variant="h3">Roles & permissions</Text>
      {roles.map((role) => {
        const mine = role.id === me?.roleId;
        return (
          <View key={role.id} className="gap-2 rounded-3xl bg-card p-4">
            <Text variant="large">{role.name}</Text>
            <Text variant="muted">
              {role._count.users} {role._count.users === 1 ? 'person' : 'people'}
              {mine ? ' · your role (locked)' : ''}
            </Text>
            {role.permissions.includes('*') ? (
              <Text variant="muted">Everything (admin)</Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {permissions.map((p) => {
                  const on = role.permissions.includes(p);
                  return (
                    <Pressable key={p} disabled={mine || update.isPending} onPress={() => toggle(role, p)} className={chip(on)}>
                      <Text className={on ? 'text-sm text-primary-foreground' : 'text-sm'}>{LABELS[p] ?? p}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            {!mine && role._count.users === 0 && (
              <Pressable testID={`role-delete-${role.id}`} onPress={() => remove.mutate(role.id)}>
                <Text className="text-destructive">Delete role</Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <Text variant="label">New role</Text>
      <Input testID="role-name" placeholder="e.g. grandparent, yaya" value={name} onChangeText={setName} />
      <Pressable
        testID="role-add"
        disabled={!name.trim() || create.isPending}
        onPress={() => create.mutate({ name: name.trim(), permissions: ['ai.use'] }, { onSuccess: () => setName('') })}
        className="rounded-3xl bg-primary p-4"
      >
        <Text variant="large" className="text-center text-primary-foreground">
          Add role
        </Text>
      </Pressable>
    </ScrollView>
  );
}
```

## 9. Alarm sound (optional, recommended for the demo)

The alarm already vibrates. For a sound, and a screen that stays on:

```
npx expo install expo-audio expo-keep-awake
```

Put a sound at `mobile/assets/alarm.mp3`, then in `HubListener()`:

```tsx
import { useAudioPlayer } from 'expo-audio';
import { useKeepAwake } from 'expo-keep-awake';

// inside HubListener(), next to the vibration effect:
useKeepAwake(); // the screen stays on, so the alarm can't be missed on stage
const player = useAudioPlayer(require('@/assets/alarm.mp3'));
useEffect(() => {
  if (!alarm) return;
  player.loop = true;
  player.play();
  return () => player.pause();
}, [alarm?.id]);
```

(This snippet needs the two packages, so it isn't part of the typechecked files.)

## 10. Reference

| What | Endpoint | Who |
|---|---|---|
| Is a hub there? | `GET /hub` → `{ ips }` (no login; the Hub address check uses it) | anyone |
| Log in / me | `POST /auth/login { email, password }` → `{ user, token }`, `GET /auth/me` | everyone |
| Poll (every 3 s) | `GET /device/poll?after=<cursor>` → `{ cursor, notices, ringing, home }` | everyone |
| Family + who's home | `GET /family` → `Person[]` | family (guests get `[]`) |
| Alarms | `GET/POST /alarms`, `PATCH/DELETE /alarms/:id`, `POST /alarms/:id/dismiss`, `/snooze` | `alarms.own`; others' alarms `alarms.family` |
| Tasks | `GET /tasks` (`?all=1` parents), `POST /tasks` (parents), `PATCH /tasks/:id { status }`, `DELETE` (parents) | `tasks.own` / `tasks.assign` |
| Talk to Jarvis | `POST /voice/text { text }` → `{ reply, pending }` (max 10 per minute) | `ai.use` |
| Points | `GET /points` → `[{ name, points, choresDone }]` | everyone |
| Briefing | `GET /briefing` → `{ text }` | `ai.use` |
| Memory | `GET /memory`, `DELETE /memory/:id` | `memory.own` |
| Grocery | `/items` | `items.*` |
| Accounts | `GET/POST /users`, `PATCH/DELETE /users/:id` | `users.manage` (parents) |
| Roles | `GET /roles`, `GET /roles/permissions`, `POST /roles`, `PATCH/DELETE /roles/:id` | `roles.manage` (parents) |

| Notice (from the poll) | Who gets it | Show |
|---|---|---|
| `alarm:ring` | the alarm's owner | nothing extra: `ringing[]` drives the full-screen alarm |
| `task:new` | the kid | "New task" popup: "Mom: Wash the dishes" |
| `task:reviewed` | parents | "Task done ✓": "Ana finished: Wash the dishes" |
| `alarm:ignored` | parents | "⏰ Alarm still ringing": "Ana's alarm has been ringing for 2 minutes." (the hub says it too) |
| `intercom` | everyone | big banner: "Announcement from Mom: dinner's ready" |
| `voice:heard` | family | "Jarvis heard…" feed (`useHeard()`) |
| `presence:arrived` / `presence:left` | family | optional toast; the family list refreshes by itself |

## 11. Check it works (5 minutes)

1. Phone: log in as **Ana**.
2. Hub: Mom says or types "wake Ana up in 1 minute" → "yes". Or on any computer, log in as Mom and
   `POST /api/alarms { "userId": 4, "label": "Wake up", "inMinutes": 1 }`.
3. Within about 70 s, Ana's phone goes full screen and vibrates. **Dismiss** closes it.
4. Mom gives Ana a task → "New task" pops up on Ana's phone.
5. Ana checks it off → Mom's phone: "Task done ✓ — Ana finished: …".
6. Mom (Settings → Accounts) adds "Lola" with a new role → Lola logs in on another phone.

## 12. Talk to Jarvis from anywhere: over the internet, by voice

Ana is at school, asks her phone, and Jarvis on the hub laptop answers. **The AI stays on the hub laptop.** Only text
goes over the internet (HTTPS through a Cloudflare tunnel), so "the AI is local" stays true.

```
Phone (anywhere) ── https://….trycloudflare.com/api ──▶ Cloudflare tunnel ──▶ hub laptop :4101 ──▶ Jarvis (local AI)
   🎤 keyboard dictation → text → POST /voice/text                            ◀── reply text
   🔊 Speech.speak(reply): the phone's own voice, works offline
```

### 12.1 On the hub laptop: open the tunnel

> ⚠️ **Change the seeded passwords first.** `family123` and `admin12345` are in the GitHub repo, and the tunnel puts
> the hub on the internet. Set new passwords with `useUpdateUser().mutate({ id, password })` (add a "New password"
> field to the Accounts screen) or ask the Hub dev, and delete `admin@example.com` (Accounts → Delete).

```
cloudflared tunnel --url http://localhost:4101
```

It prints `https://<random words>.trycloudflare.com`. **That address changes every time the tunnel restarts**, so paste
the new one in the app (12.3). Install: `winget install --id Cloudflare.cloudflared`.

Everything in the app works through the tunnel (login, Jarvis, alarms, tasks…). By design:
- A phone polling through the tunnel doesn't count as "home" (it may be at school).
- The hub mic's endpoint (`/voice/command`) refuses tunnel requests.
- Jarvis answers at most 20 turns a minute per phone.

### 12.2 Replace `mobile/lib/api.ts`

Same as before, plus a hub address the phone can change and save (`hubAddress`). Nothing else in the app changes.

```ts
import Constants from 'expo-constants';
import { fetch as streamingFetch } from 'expo/fetch';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The hub's address. Default: EXPO_PUBLIC_API_URL, else the computer running `expo start` (a phone or emulator can't
// reach "localhost", but it can reach the dev server's IP). The phone can change it in Settings → Hub address, e.g. to
// the Cloudflare tunnel to reach the hub away from home (docs/mobile-hub.md section 12).
const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || `http://${host}:4101/api`;

// A saved value: SecureStore on phones, localStorage on Expo web.
const stored = (key: string) => ({
  get: async () => (Platform.OS === 'web' ? localStorage.getItem(key) : SecureStore.getItemAsync(key)),
  set: async (value: string) =>
    Platform.OS === 'web' ? localStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  clear: async () => (Platform.OS === 'web' ? localStorage.removeItem(key) : SecureStore.deleteItemAsync(key)),
});

// The session token from login.
export const token = stored('token');

const savedHub = stored('hubUrl');
let apiUrl = DEFAULT_API_URL;
// Read the saved hub address once; every request waits for it.
const loaded = savedHub
  .get()
  .then((url) => {
    if (url) apiUrl = url;
  })
  .catch(() => {});

// "https://abc.trycloudflare.com" → "https://abc.trycloudflare.com/api", "192.168.1.20:4101" → "http://192.168.1.20:4101/api"
export function normalizeHubUrl(input: string) {
  let url = input.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  if (!/\/api$/i.test(url)) url = `${url}/api`;
  return url;
}

export const hubAddress = {
  get: async () => {
    await loaded;
    return apiUrl;
  },
  // Empty → back to the default (home Wi-Fi). The login stays: it's the same hub, reached another way.
  set: async (input: string) => {
    await loaded;
    apiUrl = input.trim() ? normalizeHubUrl(input) : DEFAULT_API_URL;
    if (apiUrl === DEFAULT_API_URL) await savedHub.clear();
    else await savedHub.set(apiUrl);
    return apiUrl;
  },
  // true when a hub answers at this address (GET /api/hub needs no login).
  test: (input: string) =>
    fetch(`${input.trim() ? normalizeHubUrl(input) : DEFAULT_API_URL}/hub`)
      .then((res) => res.ok)
      .catch(() => false),
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function authHeaders(json: boolean) {
  const headers: Record<string, string> = {};
  const session = await token.get();
  if (session) headers.Authorization = `Bearer ${session}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

const unreachable = () =>
  new ApiError(`Can't reach the hub at ${apiUrl}. Same Wi-Fi? Away from home: set Settings → Hub address.`, 0);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  await loaded;
  const headers = await authHeaders(body !== undefined);
  const res = await fetch(`${apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'omit', // the bearer token is the session; ignore the web cookie
  }).catch(() => {
    throw unreachable();
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// Streams whose first line is JSON (e.g. { sources }) and the rest is text (the AI's answer).
export async function streamWithHeader<T>(
  path: string,
  body: unknown,
  onHeader: (header: T) => void,
  onText: (text: string) => void,
  signal?: AbortSignal,
) {
  let buffer = '';
  let headerDone = false;
  await streamText(path, body, (text) => {
    if (headerDone) return onText(text);
    buffer += text;
    const newline = buffer.indexOf('\n');
    if (newline === -1) return;
    headerDone = true;
    onHeader(JSON.parse(buffer.slice(0, newline)));
    if (buffer.length > newline + 1) onText(buffer.slice(newline + 1));
  }, signal);
}

// POSTs and reads a streamed text reply (AI chat). React Native's fetch can't stream; expo/fetch can.
export async function streamText(
  path: string,
  body: unknown,
  onText: (text: string) => void,
  signal?: AbortSignal, // abort() = stop the answer (the hub stops generating too)
) {
  await loaded;
  const res = await streamingFetch(`${apiUrl}${path}`, {
    method: 'POST',
    headers: await authHeaders(true),
    body: JSON.stringify(body),
    credentials: 'omit',
    signal,
  }).catch((error) => {
    throw signal?.aborted ? error : unreachable();
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.message ?? `${res.status} ${res.statusText}`, res.status);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onText(decoder.decode(value, { stream: true }));
  }
}
```

### 12.3 New file `mobile/components/HubAddress.tsx`

```tsx
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { DEFAULT_API_URL, hubAddress } from '@/lib/api';

// Settings → "Hub address" (also on the login screen, so a new phone can find the hub).
// At home: leave it empty (home Wi-Fi). Away from home: paste the tunnel address the hub laptop shows
// (https://….trycloudflare.com). It changes every time the tunnel restarts.
export function HubAddress() {
  const qc = useQueryClient();
  const [value, setValue] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    hubAddress.get().then((url) => setValue(url === DEFAULT_API_URL ? '' : url));
  }, []);

  const save = async () => {
    setStatus('Checking…');
    if (!(await hubAddress.test(value))) {
      setStatus('No hub answers at that address. Check it, and that the tunnel runs on the hub laptop.');
      return;
    }
    const url = await hubAddress.set(value);
    setStatus(`Connected: ${url}`);
    qc.invalidateQueries(); // reload everything from the hub at its new address
  };

  return (
    <View className="gap-2">
      <Text variant="label">Hub address</Text>
      <Text variant="muted">Empty = home Wi-Fi. Away from home: the tunnel address from the hub laptop.</Text>
      <Input
        testID="hub-address"
        placeholder="https://….trycloudflare.com"
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={setValue}
      />
      <Pressable testID="hub-address-save" onPress={save} className="rounded-3xl bg-primary p-3">
        <Text className="text-center text-primary-foreground">Save</Text>
      </Pressable>
      {!!status && <Text variant="muted">{status}</Text>}
    </View>
  );
}
```

Put `<HubAddress />` in **Settings** and at the bottom of the **login screen**. A new phone away from home has to find
the hub before it can log in.

```tsx
import { HubAddress } from '@/components/HubAddress';

// …in the screen's JSX:
<HubAddress />
```

### 12.4 `talk.tsx`: say Jarvis's replies out loud, and a mic that works

`expo-speech` is already installed. Four small changes:

```tsx
import * as Speech from 'expo-speech';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View, type TextInput } from 'react-native';

// 1. next to the other state:
const inputRef = useRef<TextInput>(null);
useEffect(() => () => {
  void Speech.stop(); // leaving the screen stops the talking
}, []);

// 2. in send(), inside onSuccess, after setPending(reply.pending):
Speech.stop();
Speech.speak(reply.reply); // the phone's own voice, works offline

// 3. the big mic circle becomes a Pressable that opens the keyboard (its 🎤 key does the speech-to-text):
<Pressable
  testID="talk-mic"
  onPress={() => inputRef.current?.focus()}
  className="h-24 w-24 items-center justify-center rounded-full bg-primary"
>
  <Icon as={Microphone} weight="fill" size={32} className="text-primary-foreground" />
</Pressable>

// 4. the text input gets the ref:
<Input ref={inputRef} testID="talk-input" … />
```

**Talking into the phone:** tap 🎤 → the keyboard opens → tap the keyboard's mic and talk → Send. No extra code.

Privacy: keyboard dictation (Gboard, iPhone) may send the recording to Google/Apple. On the phone, say "Jarvis's
brain never leaves the house" rather than "your voice never leaves the house". The hub's own mic (Voice dev) stays
fully local.

Later, if there's time: an in-app mic with `expo-speech-recognition` (needs a dev build, not Expo Go), or the phone
sends the recording to the hub's own Whisper. That's the most private option, but it needs a new hub endpoint: ask the Hub dev.

### 12.5 Check it (away from home)

1. Hub laptop: `cloudflared tunnel --url http://localhost:4101` → copy the `https://…trycloudflare.com` address.
2. Phone on **mobile data** (Wi-Fi off): Settings → Hub address → paste → Save → "Connected: …".
3. Talk: "What's on the grocery list?" → Jarvis answers, and the phone says it out loud.
4. Back home: clear the Hub address → Save (home Wi-Fi again).

A release APK blocks plain `http://` addresses (home Wi-Fi) unless cleartext is allowed (`expo-build-properties` →
`android.usesCleartextTraffic: true`). Debug builds and Expo Go allow it, and the tunnel is HTTPS anyway.

---

Need a change in the API? Ask the Hub dev. Don't change `api/`: the routes and JSON shapes above are the contract.
