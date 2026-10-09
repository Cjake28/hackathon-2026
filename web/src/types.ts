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

export type Role = {
  id: number;
  name: string;
  permissions: string[];
  _count: { users: number };
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

// A chat model downloaded on the hub (AI Settings page).
export type AiModel = {
  name: string;
  sizeGb: number;
  capabilities: string[]; // "completion", "vision", "tools", "thinking"
  active: boolean;
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

// ---- Family hub (contract: TEAM-PLAN.md 4.4). Don't rename fields: the API returns exactly these. ----

export type FamilyRole = 'admin' | 'parent' | 'child' | 'guest';

export type Person = { id: number; name: string; role: FamilyRole; isHome: boolean; lastSeenAt: string | null };

export type Alarm = {
  id: number;
  userId: number;
  createdById: number;
  kind: 'alarm' | 'reminder';
  label: string;
  time: string; // "06:30"
  repeat: 'once' | 'daily' | 'weekdays';
  nextAt: string;
  enabled: boolean;
  ringingAt: string | null;
};

export type Task = {
  id: number;
  title: string;
  assigneeId: number;
  assigneeName: string;
  createdById: number;
  isChore: boolean;
  checklist: string[];
  dueAt: string | null;
  status: 'pending' | 'redo' | 'done';
  beforePhoto: string | null; // base64 JPEG
  afterPhoto: string | null;
  feedback: string | null; // the AI's chore feedback
  createdAt: string;
  doneAt: string | null;
};

export type NoticeKind =
  | 'alarm:ring'
  | 'task:new'
  | 'task:reviewed'
  | 'presence:arrived'
  | 'presence:left'
  | 'voice:heard' // data: { speaker: string, confidence: number, reply: string }
  | 'intercom';

export type Notice = { id: number; toUserId: number | null; kind: NoticeKind; text: string; data: any; createdAt: string };

// GET /api/device/poll?after=<cursor>, every 3 s. Send the returned cursor back as `after`.
export type Poll = { cursor: number; notices: Notice[]; ringing: Alarm[]; home: Person[] };

export type VoiceReply = { reply: string; speaker: { id: number; name: string; role: FamilyRole }; pending: boolean };

export type MemoryNote = { id: number; userId: number; text: string; createdAt: string };

export type FamilyEvent = { id: number; title: string; startsAt: string; userId: number | null; createdById: number };

export type Expense = { id: number; amount: number; category: string; note: string; addedById: number; spentAt: string };

export type BudgetSummary = { month: string; total: number; limit: number | null; byCategory: Record<string, number> };

// #51 #52 location (Brain dev, TEAM-PLAN.md section 9)
export type Place = { id: number; name: string; lat: number; lng: number; radiusM: number };

export type FamilyLocation = {
  userId: number;
  name: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  placeId: number | null;
  place: string | null; // the saved place they're at, or null
  since: string;
  updatedAt: string;
};

// #15 reward points (Brain dev): GET /api/points, most points first. POST /chores/:id/photo also returns `points`.
export type Points = { userId: number; name: string; points: number; choresDone: number };
