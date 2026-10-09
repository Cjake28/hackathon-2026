# Family Hub ("Jarvis"): Team Plan

**6-hour hackathon.** 3 devs + 1 UI. Everyone builds alone against **one contract** (this file) and you connect at the end.

**How there are no blockers:** at kickoff (H0, done) one commit adds every table, role, endpoint and AI tool as a
**stub that returns fake data in the final shape**. After that commit:

- the UI hits real URLs from the start (no mock JSON needed),
- every dev owns their own files, so merges don't conflict,
- anything that talks to another part (`speak()`, `notify()`) is fire-and-forget, so it works even when that part isn't running.

> **Changed after the plan review. Read this if you read the plan before:**
> 1. The alarm rule ("Mom set that one") already lives in Brain's `tools.ts` on `brain`. Hub's REST routes reuse that
>    function instead of writing their own (4.2), so voice and the UI give the same answer.
> 2. The demo alarm is "in four minutes", so it doesn't ring in the middle of steps 2–5 (section 2). `inMinutes` means
>    exactly now + N everywhere, including Hub's `POST /alarms`.
> 3. Brain follow-ups (Brain section): the chore check sends only the after photo; `/voice/command` only from the hub
>    itself; export `alarmICanChange`; rate-limit `/voice/text`.
> 4. The Cloudflare tunnel (section 9) makes the hub reachable from outside. Two consequences: a tunnelled request looks
>    like it comes from 127.0.0.1, and a phone polling through the tunnel isn't home (Hub step 6, Brain follow-ups).
> 5. A voice turn should take under 6 s on the hub laptop; measured at the 2:30 merge.
> 6. `CLAUDE.md`: frontend is `web`. Online extras now include Google sign-in. The AI stays local and the core still
>    works with the internet off.

> **Brain is merged into `main`** (Jarvis, all family AI tools, briefing, memory, chore photo check, location + Map page).
> After `git pull`: `npm install --prefix web` (map libraries), `npm run db:push` (Location + Place tables),
> `npm run db:seed` (new permissions + places). `/voice/*`, `/briefing` and `/chores` now call the real AI: run Ollama
> (`npm run ai`, model `qwen3.5:4b`) or test them against the hub laptop. Everything else still answers without Ollama.

---

## 1. What's already built (don't rebuild it)

The repo is not empty. It already does:

| Already in the repo | Covers |
|---|---|
| Local Ollama AI, works offline, LAN hub with QR join (`npm run hub`) | **#1 done** |
| Login, roles, `@Can('perm')` permission checks, Roles page | **#6 is 80% done** (only new roles needed) |
| AI tools with **Confirm before changes** (`api/src/ai/tools.ts`) + tool loop (`conversations.controller.ts`) | The brain's action system |
| Pictures in chat (`images` → vision model), `imageToBase64()` / `pickImage()` | **#4 plumbing** |
| `Item` table + Items page + `list_items` / `create_items` tools | **#58 grocery list**: just rename Items to "Grocery" |
| Read-aloud on devices (`useSpeech()`) | Device-side voice output |

Stack is fixed (see `CLAUDE.md`): NestJS + Prisma + Postgres + Ollama in `api/`, React in `web/`. The only new piece is a
small **Python voice service** in `voice/`, because offline speech-to-text and voice ID have no good Node option.

---

## 2. Scope: what you demo vs. what goes on the roadmap slide

Judges see 3–5 minutes. Build in this order and cut from the bottom.

| Priority | Features | Why |
|---|---|---|
| **P0** (no demo without it) | #2 voice (push-to-talk first), #3 voice ID, #6 roles, #7 guest, #25 alarm, #28 parent sets kid's alarm, #12 task relay + device page, #13 + #4 chore photo check | Every demo moment below uses these |
| **P1** | wake word "hey jarvis", #29 reminders (free: an alarm with `kind: "reminder"`), #58 grocery (free: Items), #30 morning briefing, #9 memory, #50 who's home | Cheap once P0 works |
| **P2** (only if on time at 4:00) | calendar page, budget page, arrival announcement that reads out chores | Seed calendar data anyway so the briefing sounds good |
| **Freebie** | #5 Tagalog/Taglish | Use the multilingual Whisper model + "reply in the user's language" and it mostly works |

**6 hours means:** push-to-talk first (wake word only if the chain works by 4:00), voice ID for 2–3 people, and no
calendar/budget pages (they already work by voice through the Brain tools).

### The 4-minute demo (everything is built for this)

1. **Mom:** "Hey Jarvis, wake Ana up in four minutes." → "Set a wake-up alarm for Ana at 2:34 PM? Say yes." → "Yes." *(#2 #3 #28 #6)*
2. **Ana:** "Hey Jarvis, delete my wake-up alarm." → "Sorry Ana, Mom set that one." Right away, no "say yes" first. *(permissions)*
3. **A judge speaks:** "Hey Jarvis, who's home?" → "I don't recognize your voice, so I can't share family info." *(#7 guest)*
4. **Mom:** "Give Ana a chore: wash the dishes." → task pops up on Ana's phone and the hub announces it. *(#12)*
5. **Ana's phone:** before photo, then a half-done after photo → "Almost! There are still cups in the sink." → retake → "Approved." *(#13 #4)*
6. The alarm from step 1 rings on Ana's phone and the hub says "Ana, wake up!" *(#25)*
7. **Ana:** "Good morning, Jarvis." → "Good morning Ana! Piano at 4, one chore left, and you said you like adobo, which is on the grocery list." *(#30 #9 #58)*
8. Turn off the Wi-Fi internet. It keeps working. "Your voice and photos never left this laptop." *(#1, privacy)*

**Timing:** the alarm must not ring before step 6. While it rings, the hub repeats "Ana, wake up!" every minute and the
mic is muted while the hub talks, so nobody can give commands. Steps 2–5 take about 3–4 minutes (two photo checks).
Rehearse with a stopwatch and change "four minutes" to fit.

---

## 3. Who does what

| Role | Owns | Features | Tests alone with |
|---|---|---|---|
| **Hub dev** (TS) | Database, roles, alarms + scheduler, tasks, device poll, who's home, calendar/budget (P2) | #6 #7(roles) #25 #28 #29 #12 #50 #58(data) | `curl` / Postman |
| **Brain dev** (TS) | Voice command endpoint, AI tools, Jarvis prompt, memory, briefing, chore vision | #1 #9 #30 #4 #13, the AI side of everything | `curl` with typed text + a speaker id |
| **Voice dev** (Python) | Mic, wake word, speech-to-text, voice ID, text-to-speech, the hub laptop's audio setup | #2 #3 #7(detect unknown voice) | Console prints `[Mom 0.91] set an alarm...` |
| **UI dev** | Every screen in `web/` | Device page (#34), dashboard, all pages | Real stub endpoints from the start |

**Hub laptop = the Brain dev's laptop** (RTX 3050 4 GB, 16 GB RAM, i5-12450H). It runs `qwen3.5:4b`, which has vision ✓ and tools ✓.
The Brain dev builds on it. The Voice dev develops on their own laptop with `--mock` and moves the mic setup to the hub
laptop at the 2:30 merge. Demo day runs entirely on this laptop.

### File ownership. Never edit a file you don't own; ask the owner in the group chat.

| Path | Owner |
|---|---|
| `api/prisma/schema.prisma`, `api/prisma/seed.ts`, `api/src/auth/permissions.ts`, `api/src/app.module.ts`, `api/src/family.ts` | **Hub** (locked after H0: changes get announced first) |
| `api/src/alarms/`, `api/src/tasks/`, `api/src/device/`, `api/src/calendar/`, `api/src/budget/`, `api/src/scheduler.service.ts` | **Hub** |
| `api/src/ai/` (incl. `tools.ts`), `api/src/voice/`, `api/src/chores/`, `api/src/memory/`, `api/src/briefing/`, `api/src/location/`, `web/src/routes/_app/map.tsx` | **Brain** |
| `voice/` | **Voice** |
| `web/` (and `mobile/` if you use it, but web-only is recommended: phones open the hub URL) | **UI** |

Git: after the H0 commit everyone branches (`hub`, `brain`, `voice`, `ui`) and merges to `main` at 2:30, 4:00 and 5:00.
Because files are owned, these merges should be clean.

**If you build with Claude/Copilot:** tell it "Read TEAM-PLAN.md. The contract (names, routes, JSON shapes) is fixed. Only edit files I own."

---

## 4. The contract (written in the H0 commit, then frozen)

### 4.1 Database: add to `api/prisma/schema.prisma`

```prisma
// add these 5 fields to the existing User model
  lastSeenAt  DateTime?    // presence: updated by GET /api/device/poll
  lastIp      String?
  alarms      Alarm[]
  tasks       Task[]
  memories    MemoryNote[]

// #25 #28 #29: alarms AND reminders (a reminder is an alarm with kind "reminder")
model Alarm {
  id          Int       @id @default(autoincrement())
  userId      Int       // who it rings for
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdById Int       // a parent, or the user themself
  kind        String    @default("alarm")  // "alarm" | "reminder"
  label       String    @default("Alarm")  // "Wake up", "Take medicine", "Leave for school"
  time        String    // "06:30", 24h, hub local time
  repeat      String    @default("once")   // "once" | "daily" | "weekdays"
  nextAt      DateTime  // next ring; the scheduler moves it forward
  enabled     Boolean   @default(true)
  ringingAt   DateTime? // set while ringing, cleared on dismiss/snooze
  createdAt   DateTime  @default(now())
}

// #12 #13: tasks from a parent; chores are checked by photo
model Task {
  id          Int       @id @default(autoincrement())
  title       String
  assigneeId  Int
  assignee    User      @relation(fields: [assigneeId], references: [id], onDelete: Cascade)
  createdById Int
  isChore     Boolean   @default(false)   // chores need before/after photos
  checklist   String[]  // what "done" looks like: ["sink is empty", "dishes are in the rack"]
  dueAt       DateTime?
  status      String    @default("pending") // "pending" | "redo" | "done"
  beforePhoto String?   // base64 JPEG
  afterPhoto  String?
  feedback    String?   // the AI's specific feedback
  createdAt   DateTime  @default(now())
  doneAt      DateTime?
}

// #9: what Jarvis remembers about each person (stays on the hub)
model MemoryNote {
  id        Int      @id @default(autoincrement())
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  text      String   // "likes adobo", "allergic to shrimp", "piano every Saturday"
  createdAt DateTime @default(now())
}

// "Push" without WebSockets: devices poll GET /api/device/poll every 3 s and receive new rows.
model Notice {
  id        Int      @id @default(autoincrement())
  toUserId  Int?     // null = every device
  kind      String   // see NoticeKind below
  text      String   // what to show
  data      Json?    // e.g. { "taskId": 7 } or { "alarmId": 3 }
  createdAt DateTime @default(now())
}

// #58 calendar
model Event {
  id          Int      @id @default(autoincrement())
  title       String
  startsAt    DateTime
  userId      Int?     // null = whole family
  createdById Int
  createdAt   DateTime @default(now())
}

// #58 budget (monthly limit lives in Setting key "budget.monthly")
model Expense {
  id        Int      @id @default(autoincrement())
  amount    Float    // pesos
  category  String   @default("other") // "food" | "bills" | "school" | "transport" | "other"
  note      String   @default("")
  addedById Int
  spentAt   DateTime @default(now())
}
```

The grocery list is the existing **`Item`** table. Don't add a new one.

### 4.2 Roles and permissions

Add to `PERMISSIONS` in `api/src/auth/permissions.ts` **and** `types.ts` in web:

```ts
'alarms.own',     // set/see/dismiss your own alarms and reminders
'alarms.family',  // set alarms/reminders for others (#28)
'tasks.own',      // see your tasks, send chore photos
'tasks.assign',   // give tasks to others, see everyone's
'calendar.use',
'budget.use',
'presence.read',  // who's home (never for guests)
'memory.own',     // Jarvis remembers things about you
```

Roles and demo family in `seed.ts` (password `family123` for all):

| Role | Permissions | Seeded people |
|---|---|---|
| `admin` | `*` | admin@example.com (existing) |
| `parent` | items.\*, ai.use, alarms.own, alarms.family, tasks.own, tasks.assign, calendar.use, budget.use, presence.read, memory.own | Mom `mom@family.local`, Dad `dad@family.local` |
| `child` | items.read, items.create, ai.use, alarms.own, tasks.own, calendar.use, presence.read, memory.own | Ana `ana@family.local`, Ben `ben@family.local` |
| `guest` | ai.use | Guest `guest@family.local` (used for every unknown voice) |

Seed also: 3 events today/tomorrow ("Ana piano 4 PM", "Family dinner at Lola's Sat"), 4 grocery items, 2 memory notes,
1 pending chore for Ana with a checklist. A good seed is what makes the briefing and the demo sound smart.

Rule (Hub): **a child can't delete or disable an alarm a parent created** → 403 `"Mom set that alarm."`
Brain already wrote this rule as `alarmICanChange(prisma, user, id)` in `api/src/ai/tools.ts` (on `brain`; voice uses it).
Hub's `PATCH` / `DELETE /alarms/:id` call the same function (Brain exports it) instead of writing a second copy, so voice
and the UI always give the same answer.

### 4.3 Shared helpers: `api/src/family.ts` (Hub writes it at H0; everyone calls it)

```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from './auth/auth.guard';
import { hasPermission, type Permission } from './auth/permissions';
import type { PrismaService } from './prisma.service';

const VOICE_URL = process.env.VOICE_URL || 'http://127.0.0.1:4103';

export type NoticeKind =
  | 'alarm:ring' | 'task:new' | 'task:reviewed'
  | 'presence:arrived' | 'presence:left' | 'voice:heard' | 'intercom';

// The hub says something out loud. Fire-and-forget: does nothing if the voice service is off.
export function speak(text: string) {
  void fetch(`${VOICE_URL}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

// Shows something on devices (picked up by GET /api/device/poll). toUserId null = every device.
export function notify(prisma: PrismaService, toUserId: number | null, kind: NoticeKind, text: string, data?: object) {
  return prisma.notice.create({ data: { toUserId, kind, text, data: data as Prisma.InputJsonValue } });
}

// "Ana" / "ana" / "me" / "ako" → the user. Voice and AI use names, not ids.
export async function findPerson(prisma: PrismaService, name: string | undefined, me: AuthUser) {
  if (!name || /^(me|myself|ako)$/i.test(name.trim())) return prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const user = await prisma.user.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' } } });
  if (!user) throw new NotFoundException(`I don't know anyone called ${name}`);
  return user;
}

// Doing something for someone else (Ana's alarm, Ana's task) needs the family permission.
export function assertCanActFor(me: AuthUser, targetUserId: number, familyPermission: Permission) {
  if (targetUserId !== me.id && !hasPermission(me.permissions, familyPermission)) {
    throw new ForbiddenException('Only a parent can do that for someone else');
  }
}

// Next time an alarm rings. time = "HH:mm" (hub local time).
export function nextAt(time: string, repeat: string, from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const next = new Date(from);
  next.setHours(h, m, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  if (repeat === 'weekdays') while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next;
}
```

### 4.4 JSON shapes (UI copies these into `web/src/types.ts`)

```ts
type Role = 'admin' | 'parent' | 'child' | 'guest';
type Person = { id: number; name: string; role: Role; isHome: boolean; lastSeenAt: string | null };
type Alarm = {
  id: number; userId: number; createdById: number; kind: 'alarm' | 'reminder'; label: string;
  time: string; repeat: 'once' | 'daily' | 'weekdays'; nextAt: string; enabled: boolean; ringingAt: string | null;
};
type Task = {
  id: number; title: string; assigneeId: number; assigneeName: string; createdById: number; isChore: boolean;
  checklist: string[]; dueAt: string | null; status: 'pending' | 'redo' | 'done';
  beforePhoto: string | null; afterPhoto: string | null; feedback: string | null; createdAt: string; doneAt: string | null;
};
type NoticeKind = 'alarm:ring' | 'task:new' | 'task:reviewed' | 'presence:arrived' | 'presence:left' | 'voice:heard' | 'intercom';
type Notice = { id: number; toUserId: number | null; kind: NoticeKind; text: string; data: any; createdAt: string };
type Poll = { cursor: number; notices: Notice[]; ringing: Alarm[]; home: Person[] };
type VoiceReply = { reply: string; speaker: { id: number; name: string; role: Role }; pending: boolean };
type MemoryNote = { id: number; userId: number; text: string; createdAt: string };
type FamilyEvent = { id: number; title: string; startsAt: string; userId: number | null; createdById: number };
type Expense = { id: number; amount: number; category: string; note: string; addedById: number; spentAt: string };
type BudgetSummary = { month: string; total: number; limit: number | null; byCategory: Record<string, number> };
```

`voice:heard` notice `data` = `{ speaker: string, confidence: number, reply: string }`. The dashboard shows it as a live
"Jarvis heard..." transcript, which judges love.

### 4.5 Endpoints (all under `/api`, logged in unless marked)

**Hub dev**

| Method | Path | Permission | Body → Returns |
|---|---|---|---|
| GET | `/family` | login | → `Person[]` |
| GET | `/device/poll?after=<cursor>` | login | → `Poll`. Also the heartbeat: sets `lastSeenAt`. First call without `after` returns the last 5 minutes. `home` is empty without `presence.read` |
| GET | `/alarms?userId=&all=1` | alarms.own (others: alarms.family) | → `Alarm[]` (mine by default) |
| POST | `/alarms` | alarms.own | `{ userId?, kind?, label?, time?: "HH:mm", inMinutes?: number, repeat? }` → `Alarm` |
| PATCH | `/alarms/:id` | alarms.own | `{ enabled?, label?, time?, repeat? }` → `Alarm` |
| DELETE | `/alarms/:id` | alarms.own | → `Alarm` (403 for a child on a parent's alarm) |
| POST | `/alarms/:id/dismiss` | alarms.own | → `Alarm` (`once` gets disabled, repeats move `nextAt` forward) |
| POST | `/alarms/:id/snooze` | alarms.own | `{ minutes?: 5 }` → `Alarm` |
| GET | `/tasks?all=1` | tasks.own (`all`: tasks.assign) | → `Task[]` |
| POST | `/tasks` | tasks.assign | `{ title, assigneeId, isChore?, checklist?, dueAt? }` → `Task` (+ `task:new` notice + `speak`) |
| PATCH | `/tasks/:id` | tasks.own (assignee) | `{ status: "done" }` → `Task` (non-chores only) |
| DELETE | `/tasks/:id` | tasks.assign | → `Task` |
| GET/POST/DELETE | `/events`, `/events/:id` | calendar.use | `{ title, startsAt, userId? }` → `FamilyEvent` (P2) |
| GET/POST/DELETE | `/expenses`, `/expenses/:id`; GET `/expenses/summary?month=2026-10` | budget.use | `{ amount, category, note? }` → `Expense` / `BudgetSummary` (P2) |

Grocery = existing `/items` routes, unchanged.

**Brain dev**

| Method | Path | Permission | Body → Returns |
|---|---|---|---|
| POST | `/voice/command` | `@Public()` + header `x-hub-key` + only from the hub itself | `{ speakerId: number \| null, confidence: number, text: string }` → `VoiceReply`. `null` = guest |
| POST | `/voice/text` | ai.use + `ThrottlerGuard` (speaker = me) | `{ text }` → `VoiceReply`. Typed Jarvis, also the on-stage fallback |
| GET | `/voice/people` | `@Public()` + `x-hub-key` + only from the hub itself | → `{ id, name, role }[]` (for voice enrollment) |
| POST | `/chores/:taskId/photo` | tasks.own (assignee) | `{ stage: "before" \| "after", image: base64 }` → `Task` (after: status + feedback filled by the AI, `task:reviewed` notice to the parent) |
| GET | `/briefing` | ai.use | → `{ text }` (spoken-style morning summary for me) |
| GET/POST/DELETE | `/memory`, `/memory/:id` | memory.own | `{ text }` → `MemoryNote` (own notes only) |

**Voice dev** (Python, `http://127.0.0.1:4103`, only the hub calls it)

| Method | Path | Body → Returns |
|---|---|---|
| POST | `/speak` | `{ text }` → `{ ok: true }`. Queued, never talks over itself |
| GET | `/health` | → `{ ok, listening, lastSpeaker }` |

### 4.6 AI tools (`api/src/ai/tools.ts`, Brain owns; stubs at H0)

Every tool resolves names with `findPerson()` and checks `assertCanActFor()`. Read-only tools are `confirm: false`;
changes are `confirm: true`.

| Tool | Params | Permission | Confirm |
|---|---|---|---|
| `set_alarm` | `{ person?, time?: "HH:mm", inMinutes?, label?, repeat?, kind? }` | alarms.own | yes |
| `list_alarms` | `{ person? }` | alarms.own | no |
| `cancel_alarm` | `{ id }` | alarms.own | yes |
| `give_task` | `{ person, title, isChore? }` | tasks.assign | yes |
| `list_tasks` | `{ person? }` | tasks.own | no |
| `list_items` / `create_items` / `set_item_done` | existing; reword descriptions to "grocery list" | items.\* | existing |
| `list_events` / `add_event` | `{ day? }` / `{ title, startsAt, person? }` | calendar.use | no / yes |
| `budget_summary` / `add_expense` | `{}` / `{ amount, category, note? }` | budget.use | no / yes |
| `who_is_home` | `{}` | presence.read | no |
| `remember` | `{ text }` | memory.own | yes |
| `morning_briefing` | `{}` | ai.use | no |

`inMinutes` exists for the demo: nobody waits until 6 AM on stage. It rings at exactly now + N; don't go through
`nextAt(time)`, which zeroes the seconds, so "in 1 minute" would ring anywhere from 0 to 60 s later.

**Check before asking** (done on `brain`): a confirm tool can have `check(args, deps)`. The voice loop runs it before
proposing the action, and a refusal is spoken right away instead of "Say yes" (demo step 2). Guests get no tools, and
`search_documents` isn't offered to voice.

### 4.7 Env vars

- `api/.env`: `HUB_KEY=<any long random string>`, `VOICE_URL=http://127.0.0.1:4103`
- `voice/.env`: `HUB_URL=http://127.0.0.1:4101/api`, `HUB_KEY=<same string>`

---

## 5. Task lists

### H0: Contract commit: DONE, already on `main`

- [x] Schema from 4.1
- [x] Permissions (4.2) in `permissions.ts` + `web/src/types.ts` + `mobile/types.ts`; roles, demo family and demo data in `seed.ts`
- [x] `api/src/family.ts` exactly as 4.3; the JSON shapes (4.4) in `web/src/types.ts`
- [x] Every controller in 4.5 registered in `app.module.ts`, returning fake data in the final shape (`api/src/fake.ts`)
- [x] Every tool in 4.6 in `tools.ts` with a stub `run()`; item tools reworded to "grocery list"
- [x] `HUB_KEY` / `VOICE_URL` in `api/.env.example` (`npm run setup` adds them); `voice/` folder with README + `.env.example`
- [x] `npm run typecheck` passes; every endpoint smoke-tested with curl

Already real: permission checks (`@Can`), the hub-key check and speaker lookup in `/voice/command`, and `/voice/people`.
Everything else returns fake data. When your endpoint is real, stop importing from `fake.ts`.

**H0 follow-up:**

- [x] `CLAUDE.md`: frontend set to `web`, so nobody's Claude builds mobile screens. `mobile/` stays on disk, untouched.

**Start here (everyone):**

```
git pull
npm run setup        # adds HUB_KEY + VOICE_URL to your api/.env
npm run db:up
npm run db:push
npm run db:seed      # family logins below (resets the demo data)
git checkout -b <hub|brain|voice|ui>
```

Logins (password `family123`): `mom@family.local` and `dad@family.local` (parent), `ana@family.local` and
`ben@family.local` (child), `guest@family.local` (guest). Admin: `admin@example.com` / `admin12345`.
User ids after a fresh seed: Admin 1, Mom 2, Dad 3, Ana 4, Ben 5, Guest 6.

### Hub dev

1. **Roles live.** Log in as Ana: `POST /alarms` with `userId` = Mom → 403. Log in as Mom → works.
2. **Alarms CRUD** using `nextAt()`; `inMinutes` → `nextAt` = now + N exactly (like the `set_alarm` tool). Rule: a child
   can't delete or disable a parent's alarm: call Brain's `alarmICanChange()` (4.2), don't write a second copy.
3. **Scheduler** (`scheduler.service.ts`, `setInterval` every 10 s in `onApplicationBootstrap`): `enabled && nextAt <= now && !ringingAt`
   → set `ringingAt`, `notify(userId, 'alarm:ring', label, { alarmId })`, `speak("<Name>, <label>!")`. While ringing,
   repeat `speak` every 60 s. (Later, #27: after 5 min, notify parents.)
4. **Dismiss / snooze.**
5. **Tasks** CRUD; `POST /tasks` → `task:new` notice to the assignee + `speak("Ana, Mom gave you a task: …")`.
6. **Device poll:** notices `where id > after AND (toUserId = me OR toUserId IS NULL)`, ringing alarms for me, people home
   (`lastSeenAt` within 2 min). Update `lastSeenAt`/`lastIp`. If my previous `lastSeenAt` was over 10 min ago or null
   → `presence:arrived` notice to everyone + `speak("Welcome home, Ana")`.
   A poll that came **through the Cloudflare tunnel** (it has a `cf-connecting-ip` header) doesn't count as home: that
   phone may be at school. Only polls over the home Wi-Fi update home presence.
7. **`/family`** with `isHome`.
8. **Demo seed:** times relative to now (piano = now + 2 h, not a fixed 4 PM), so the briefing is right whenever you demo.
9. P2: events, expenses, budget summary.

**Done alone when:** a curl script creates an alarm with `inMinutes: 1` for Ana, and within ~70 s Ana's `/device/poll`
returns it in `ringing` plus an `alarm:ring` notice.

### Brain dev: DONE and merged to `main` (Jarvis + location)

1. **`/voice/text` first** (needs no voice and no hub key). Copy `agentReply()` from `conversations.controller.ts`
   (duplication is fine). The system prompt adds: Jarvis personality, **reply in 1–2 short sentences, no Markdown (it's
   spoken)**, reply in the user's language (English/Tagalog/Taglish), the **current date and time** (the model doesn't know
   it), the speaker's name and role, their memory notes, and who's home.
2. Each person gets one **"Voice" conversation** (`useTools: true`). Save every exchange there, so the web chat page shows
   the history and its Confirm button works too.
3. **Voice confirm:** if the speaker's last message has a pending action and the text is yes/oo/sige/okay/go → run it
   (copy `resolveAction`); no/hindi/cancel → cancel. Pending actions expire after 60 s.
4. **`/voice/command`**: same logic, `@Public()`, reject when `x-hub-key` doesn't match; `speakerId: null` → the Guest user.
   Write a `voice:heard` notice.
5. **Fill tool bodies** (4.6) with prisma + `family.ts` helpers. If the small model picks wrong tools, route first:
   `ai.json` → `{ group: "alarms" | "tasks" | "lists" | "calendar" | "budget" | "chat" }`, then offer only that group's tools.
6. **Memory** endpoints + `remember` tool + notes in the prompt.
7. **Briefing:** gather today's alarms, events, pending tasks, grocery count → `ai.text` → `{ text }`.
8. **Chore vision:** add an `images?: string[]` parameter to `ai.json()` in `ai.service.ts`. On `after`, send the
   before and after photos with the checklist → `{ done: boolean, feedback: string }` (specific: "two cups still in the
   sink"). If the small model mixes up two pictures, describe each one with its own `ai.json` call and then compare the
   descriptions. `done` → status `done`, else `redo`. Then `task:reviewed` notice to the parent + `speak`.

**Done alone when:** `curl /voice/text "wake Ana up in 1 minute"` as Mom → pending → `"yes"` → the alarm row exists.
As Ana: "delete my wake-up alarm" → a polite refusal. As guest: "who's home?" → refused.

**Follow-ups from the plan review: all done** (tested live on the hub laptop):

- [x] **Chore check: send only the after photo** with the checklist (3.6 s → under 1 s with the GPU fix below).
      Comparing two photos is what small vision models do worst, and two images double the wait. Keep the before photo
      for the parent's view, and rehearse with the same sink and cups you'll use on stage.
- [x] **`/voice/command` and `/voice/people` only from the hub itself** (tunnel and LAN requests get 403). Accept `req.ip` `127.0.0.1` / `::1` /
      `::ffff:127.0.0.1` **with no `cf-connecting-ip` header**. The tunnel's `cloudflared` runs on the hub, so a request
      from the internet also arrives from 127.0.0.1. Without this, the hub key alone lets anyone speak as Mom.
- [x] **Export `alarmICanChange`** from `tools.ts` (the Hub dev made the same one-line change on `hub`), so Hub's REST routes use the same rule (4.2).
- [x] **`ThrottlerGuard` on `/voice/text`** (it's an AI endpoint, see `CLAUDE.md`).
- [x] **Speed: target met, 1.4–3.1 s per typed turn** (was 5–8 s). The cause wasn't the prompt: Ollama kept half of
      the model on the CPU (46% on the GPU, 12.7 tokens/s). `AI_GPU_LAYERS=99` in `api/.env` puts every layer on the
      RTX 3050 (100%, 43 tokens/s), and embeddings run on the CPU so they can't push it off. Keyword routing was tried and
      dropped: barely faster, and it made a Tagalog alarm request fail.

      `npm run ai:bench -- --gpu=auto` vs `--gpu=99` (fresh load each, qwen3.5:4b, context 8192):

      | GPU layers | On GPU | Tokens/s | Seconds per answer | Jarvis tool call | Correct | JSON |
      |---|---|---|---|---|---|---|
      | auto (Ollama decides) | 46% | 12.7 | 17.9 | 2.9 s | 3/3 | valid |
      | **99 (hub laptop)** | **100%** | **43.1** | **6.0** | **0.9 s** | 3/3 | valid |

      Keep the GPU free on demo day: in Windows Settings → Display → Graphics, set Chrome/Edge to "Power saving" (Intel GPU),
      and close games. Only ~80 MB of the 4 GB is left.

**Brain next (decided):**

1. **Now: names the way speech-to-text writes them.** Tested first: every demo line already works **10/10**
   (0.8–1.9 s) after the GPU fix, so demo-line shortcuts were dropped (no gain). The real risk found: Whisper writes
   "Anna", and Jarvis answered "I don't know anyone called Anna" (3/3), same for "mama". Fix in Brain's `person()`:
   nicknames (mama/mommy/nanay → Mom, papa/daddy/tatay → Dad), possessives ("Ana's"), and doubled letters ("Anna" →
   Ana, "Benn" → Ben). Also: fixed guest reply text and "Welcome home, Ana" without "!", so they match the Voice dev's
   pre-recorded clips (instant voice). Proof: the 10× demo test again, plus the misspelled names.
2. **Then: help the team.** The demo can't run without alarms ringing (Hub), Ana's phone screen (UI) and the mic (Voice).
   Brain owns the hub laptop and runs the 2:30 merge.
3. **Only if there's time at the end:** intercom ("tell everyone dinner's ready", #18), reward points for approved
   chores (#15), "Welcome home Ana, you still have 2 chores" on arrival (#54), and prompt caching (fixed system
   prompt, changing parts at the end; about 1 s faster per turn).
4. **Not doing:** a smaller model or a lower quantization. `qwen3.5:4b` is already Q4_K_M, fits 100% on the GPU and
   answers in 1–3 s; going smaller makes it dumber for a speed problem we no longer have.

### Voice dev

1. **Spike first (first 45 minutes):** get each library printing results. If one won't install on Windows within
   30 min, switch to the fallback.
   - Mic: `sounddevice`, 16 kHz mono
   - Speech-to-text: `faster-whisper`, **multilingual** `small` (or `base` if slow), int8 on CPU. This makes Tagalog nearly free.
     Use `vad_filter=True`: without it, Whisper makes up text from silence ("Thank you for watching").
     **On the hub laptop, keep Whisper on the CPU** (`device="cpu"`, `compute_type="int8"`, `beam_size=1`): Jarvis fills the
     GPU (about 80 MB left). On the GPU, Whisper would fight Jarvis for memory and both would slow down.
   - Wake word: `openwakeword` has a ready **`hey_jarvis`** model (use `inference_framework="onnx"` on Windows)
   - Voice ID: SpeechBrain ECAPA (`speechbrain/spkrec-ecapa-voxceleb`) + cosine similarity; fallback `resemblyzer`
   - Text-to-speech: `pyttsx3` (Windows voices, offline, no download). It can hang after the first sentence when run from
     a thread. Fallback: `win32com.client.Dispatch("SAPI.SpVoice").Speak(text)`, with `pythoncom.CoInitialize()` in that
     thread. Offline, Taglish is read by an English voice (ElevenLabs in section 9 fixes that when online).
   - All-in-one fallback if the above fights you: `sherpa-onnx` (keyword spotting, speech-to-text, speaker ID, text-to-speech)
2. **Push-to-talk first** (Enter = record until silence or 8 s). Add the wake word after the whole chain works.
3. **Enrollment CLI:** `python enroll.py --user-id 4` records 3–5 sentences and saves the averaged embedding to
   `voice/profiles/4.npy`. Get ids from `GET /voice/people`.
4. **Identify:** best cosine score ≥ threshold → `speakerId`, else `null` (guest). Tune the threshold in the venue.
5. **Loop:** wake/PTT → record → transcribe + identify → `POST /voice/command` → speak `reply`.
   Feel instant: a short beep when the person stops talking (Jarvis takes 1–3 s to answer), and save the audio of fixed
   lines ("Say yes to confirm", "Okay, cancelled", "Ana, wake up!") so they play right away.
   **Mute the mic while speaking**, or Jarvis hears itself.
6. **`/speak` server** (FastAPI or `http.server`) with a queue and one TTS thread (pyttsx3 isn't thread-safe).
7. **Stage fallback:** keys `1`–`5` force the next speaker, `0` = automatic.
8. **Mock mode** (`--mock`): when the hub isn't running, print what would be sent and speak "mock reply".

**Done alone when:** the console prints `[Ana 0.87] delete my alarm` for each enrolled person, `[guest 0.41]` for a stranger,
and `/speak` talks.

### UI dev

Build **web only** (phones and tablets open the hub URL). Leave `mobile/` alone.

1. **Device page** `/device` (Ana's phone). One `useQuery` on `/device/poll` with `refetchInterval: 3000`.
   - A **"Tap to start"** button first. Phones block sound until a tap, and a silent alarm ruins the demo.
   - Full-screen alarm when `ringing` isn't empty: Dismiss / Snooze, plays a beep from `web/public/` (no CDN).
   - Task popup on `task:new`; my tasks list; chore flow: **before photo → after photo → show AI feedback**.
     Use `<input type="file" accept="image/*" capture="environment">`: live camera (`getUserMedia`) needs HTTPS,
     the hub is plain HTTP.
2. **Parent dashboard** (home page on the hub laptop): family with home/away, a live **"Jarvis heard…"** transcript from
   `voice:heard`, today's alarms, tasks with before/after photos and AI feedback, a "Type to Jarvis" box (`/voice/text`).
3. **Alarms page** (parent can pick a person), **Tasks page** (assign / my tasks).
4. Rename Items → **Grocery**. **Memory page** "What Jarvis remembers about me" with delete (a privacy feature to show judges).
5. P2: Calendar, Budget.

Copy the patterns in `CLAUDE.md` (hooks like `useItems.ts`, pages like `_app/items.tsx`, nav with permissions).

---

## 6. Timeline

You connect at the end, but merge twice before that. Each merge is 30 minutes because of the stubs. Teams that wait until
the last hours to connect lose the demo.

| When | What |
|---|---|
| **Before the event** (needs internet) | Pick the hub laptop (best GPU/RAM). `ollama pull` a chat model that shows **vision ✓ tools ✓** on AI Settings (`npm run ai:bench` to compare). Voice dev installs Python deps and downloads every model **on the hub laptop**. `npm run setup`, Docker image pulled. Bring a headset/USB mic, a speaker and a phone for hotspot |
| 0:00–0:30 | Setup commit (done) |
| 0:30–2:30 | Build alone. Each dev reaches their "done alone when" |
| **2:30 merge (20 min)** | Typed chain: `/voice/text` as Mom → alarm → Ana's device page rings. No voice yet. Time a turn on the hub laptop: **target under 6 s** |
| 2:50–4:00 | Real logic everywhere. Voice dev connects to `/voice/command` on the hub laptop |
| **4:00 merge (20 min)** | Full voice chain on the hub laptop. Cut whatever isn't working |
| 4:20–5:00 | P1 polish, demo seed data, online extras only if the core works |
| **5:00: FEATURE FREEZE** | Rehearse the demo 3 times on the hub laptop + real phones with a stopwatch (alarm timing), record a backup video, `npm run backup`. Right before going on stage: `npm run db:seed` and open every demo phone's device page |
| 5:30–6:00 | Pitch (second/third-tier features go on the roadmap slide) |

---

## 7. Risks and fallbacks

| Risk | Fallback (build it, don't hope) |
|---|---|
| Voice ID fails in a noisy hall | Headset mic; keys `1`–`5` force the speaker; tune the threshold at the venue |
| Wake word misses | Push-to-talk stays in; say "press to talk, wake word works at home" |
| Small model picks the wrong tool or time | `inMinutes`, current time in the prompt, tool router (Brain step 5), short tool descriptions |
| Phone alarm is silent | "Tap to start" on the device page; keep the phone screen on during the demo |
| Camera won't open on phone | File input with `capture`, not `getUserMedia` |
| Venue Wi-Fi blocks devices from seeing each other | Phone hotspot for the hub + phones; allow Node in Windows Firewall (Private) |
| Vision is slow on CPU | The hub says "let me take a look…" while it checks; keep photos small (resize to ~768 px) |
| Chore check says the wrong thing | Only the after photo + checklist goes to the AI; rehearse with the same sink and cups |
| Every voice turn is slow | Under-6-s target at 2:30; keyword routing; yes/no skips the AI; typed `/voice/text` as backup |
| The alarm rings in the middle of another demo step | Rehearse with a stopwatch; change "in four minutes" to fit |
| "Welcome home, Ana" interrupts the demo (a phone woke up after 10+ min) | Open every demo phone's device page before you start; keep screens on |
| Hub laptop sleeps | Power plugged in, sleep off |
| Everything breaks on stage | Backup video + `npm run restore` to a known-good DB |

## 8. Privacy rules (apply to everything)

- Audio is transcribed in memory and never saved. Voice profiles stay in `voice/profiles/` on the hub.
- Chore photos and memory notes stay in the hub's Postgres.
- Online services only for extras (section 9, Google sign-in; see `CLAUDE.md`). They only get small results (reply text,
  map tiles, coordinates when someone asks where Ana is, a login), never audio, photos or memory notes. The hub keeps working when
  they're offline.
- Guests never get family data: the `guest` role has only `ai.use`, and permissions are checked in the API, never in the AI prompt.
- The prompt is data too: a guest's prompt never contains family info (who's home, memory notes), because anything in the
  prompt can come out in the reply. (Done on `brain`: guests get their own prompt and no tools.)
- Only the hub itself may call `/voice/command`: the hub key alone isn't enough, since the API is open to the whole Wi-Fi
  and, through the tunnel, the internet.

## 9. Online extras (only after the core works; the hub must still work with the internet off)

### ElevenLabs voice (#5 Filipino). Voice dev, after the 4:00 merge

Only text-to-speech goes online. Speech-to-text stays local (Whisper), so recordings never leave the house.
`ELEVENLABS_API_KEY` goes in `voice/.env`. Inside `/speak`:

```
text → spoken before?            → play the saved audio file (instant, no credits)
     → online + key + credits?   → ElevenLabs (fast multilingual model), wait max 2 s
                                      ok        → play it + save it for next time
                                      slow/fail → local voice
     → offline                   → local voice (Kokoro, pyttsx3 as backup)
after speaking → unmute the mic
```

One voice for everything when online (English and Filipino), so Jarvis doesn't sound like two people.
Demo line: pull the internet and Jarvis keeps talking with the local voice.

### Location (#51 "Where is Ana?", #52 safe zones). Brain dev

- The phone shares GPS from the web app's **Map** page. Phone browsers only share GPS over HTTPS, so the phone opens the
  hub through a Cloudflare quick tunnel: `cloudflared tunnel --url http://localhost:4101` (hub mode) prints an
  `https://….trycloudflare.com` address. That also works when the phone is away from home.
- The hub stores each person's last location and checks it against **places** (home, school, Lola's, with a radius).
  Arriving at a place → `presence:arrived` notice + the hub says "Ana arrived at School".
- Jarvis: "Where is Ana?" → `where_is` tool (parents only: `location.read`). With Google: "Ana is near SM Megamall, about
  15 minutes from Home by car" (Geocoding + Routes APIs, called by the hub only when someone asks; #57 arrival estimate).
- Map page: **Google Maps** when a key is set, **Leaflet + OpenStreetMap** (free, no key) when it isn't. Same features on both.
- Keys (Brain dev's GCP credits): enable **Maps JavaScript API, Geocoding API, Routes API**.
  `VITE_GOOGLE_MAPS_KEY` in `web/.env` (browser key, restrict to `localhost` and `*.trycloudflare.com`),
  `GOOGLE_MAPS_KEY` in `api/.env` (server key for geocoding and travel time). No key → everything still works, just plainer.
- Locations are stored on the hub. Google only gets coordinates when someone asks "Where is Ana?" or opens the map.
- Demo: everyone is in the same room, so make a place called "School" around the venue with "Add place here".
