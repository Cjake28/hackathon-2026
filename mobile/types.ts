// Frontend copies of the backend models. Duplicating them is fine.

// Every permission in the app. Keep in sync with api/src/auth/permissions.ts.
export const PERMISSIONS = [
  'items.read',
  'items.create',
  'items.update',
  'items.delete',
  'users.manage',
  'roles.manage',
  'ai.use',
  'docs.manage',
  'ai.manage',
  'alarms.own',
  'alarms.family',
  'tasks.own',
  'tasks.assign',
  'calendar.use',
  'budget.use',
  'presence.read',
  'memory.own',
  'location.share',
  'location.read',
  'intercom.send',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export type User = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleId: number;
  role: string;
  permissions: string[]; // "*" = every permission
};

export type Item = {
  id: number;
  name: string;
  done: boolean;
  createdAt: string;
};

// Local AI (Ollama on the hub). `missing` lists models that still need `ollama pull`.
// `vision`: the chat model can read pictures. `tools`: it can use app tools.
export type AiStatus = {
  online: boolean;
  model: string;
  embeddingModel: string;
  missing: string[];
  vision: boolean;
  tools: boolean;
};

// RAG
export type RagDocument = {
  id: number;
  title: string;
  source: string;
  createdAt: string;
  _count: { chunks: number };
};

export type Source = { n: number; documentId: number; title: string; page: number | null; snippet: string; score: number };

export type AskResult = { answer: string; sources: Source[] };

// Saved AI chats
export type Conversation = { id: number; title: string; useDocs: boolean; useTools: boolean; updatedAt: string };

// A tool action the AI wants to do, waiting for the user's OK.
export type PendingAction = {
  tool: string;
  args: Record<string, unknown>;
  description: string;
  status: 'pending' | 'done' | 'cancelled';
};

export type ConversationMessage = {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  image: string | null; // base64 JPEG
  sources: Source[] | null;
  action: PendingAction | null;
  createdAt: string;
};

export type ConversationWithMessages = Conversation & { messages: ConversationMessage[] };

// --- Local-only screens (the network demo, the read-only calendar and budget). Everything else is on the hub. ---

export type Role = 'parent' | 'child' | 'guest';
export type RecognitionState = 'enrolled' | 'learning' | 'none';
export type AccentName = 'arc' | 'azure' | 'teal' | 'amber' | 'violet' | 'rose';

export type FamilyMember = {
  id: string;
  name: string;
  role: Role;
  accent: AccentName;
  voice: RecognitionState;
  face: RecognitionState;
  home: boolean;
  room?: string;
  points: number;
  note?: string;
};

export type Capability =
  | 'ask'
  | 'ownAlarms'
  | 'othersAlarms'
  | 'ownTasks'
  | 'assignTasks'
  | 'reviewChores'
  | 'network'
  | 'location'
  | 'smartHome'
  | 'cameras'
  | 'hubAdmin';

export type TaskStatus = 'assigned' | 'doing' | 'submitted' | 'approved' | 'rejected';
export type TaskKind = 'task' | 'chore';

export type FamilyTask = {
  id: string;
  title: string;
  detail?: string;
  kind: TaskKind;
  status: TaskStatus;
  assigneeId: string;
  assignedById: string;
  createdAt: string;
  due?: string;
  room?: string;
  points: number;
  beforePhoto?: string;
  afterPhoto?: string;
  feedback?: string;
};

export type Alarm = {
  id: string;
  label: string;
  /** 24-hour "HH:MM". */
  time: string;
  /** 0 = Sunday. Empty = one-off. */
  days: number[];
  ownerId: string;
  setById: string;
  enabled: boolean;
  escalateToId?: string;
  escalateAfterMins: number;
  kind: 'alarm' | 'reminder';
};

export type DeviceKind = 'phone' | 'laptop' | 'tablet' | 'tv' | 'console' | 'unknown';
export type BlockCategory = 'social' | 'games' | 'video' | 'adult' | 'shopping' | 'chat';

export type HomeDevice = {
  id: string;
  name: string;
  kind: DeviceKind;
  ownerId?: string;
  online: boolean;
  lastSeen: string;
  blocked: BlockCategory[];
  paused: boolean;
  isNew?: boolean;
};

export type Speaker = 'hub' | 'person';

export type Utterance = {
  id: string;
  speaker: Speaker;
  text: string;
  personId: string | null;
  role: Role;
  room?: string;
  createdAt: string;
  streaming?: boolean;
  refused?: boolean;
};

export type ListenState = 'idle' | 'listening' | 'thinking' | 'speaking';

// Calendar (#58), budget and location, as TEAM-PLAN.md 4.4 defines them.
// GroceryItem below is the on-phone shape; the Grocery screen uses /items.
export type GroceryItem = {
  id: string;
  name: string;
  note?: string;
  done: boolean;
  addedBy: string;
};

export type ExpenseCategory = 'food' | 'bills' | 'school' | 'transport' | 'other';

export type Expense = {
  id: number;
  amount: number;
  category: string; // usually an ExpenseCategory, but Onai can invent others
  note: string;
  addedById: number;
  spentAt: string;
};

export type BudgetSummary = {
  month: string; // "2026-10"
  total: number;
  limit: number | null;
  byCategory: Record<string, number>;
};

// Where someone was last seen (parents only). `place` is a named spot like "Home" or "School".
export type Whereabouts = {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  place: string | null;
  since: string;
  updatedAt: string;
};

export type Place = { id: number; name: string; lat: number; lng: number; radiusM: number };

// A calendar event on the hub (GET /events). userId null = the whole family.
export type HubEvent = {
  id: number;
  title: string;
  startsAt: string;
  userId: number | null;
  createdById: number; // whoever added it (they, or a parent, may move or delete it)
  createdAt: string;
};

// ---- Hub API (TEAM-PLAN.md 4.4, docs/mobile-hub.md). "Hub" names so they don't clash with the local types above. ----
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
  beforePhoto: string | null;
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
  | 'alarm:ignored' // parents: a kid's alarm rang 2 min with no dismiss
  | 'event:soon'; // a calendar event starts in 15 min
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
