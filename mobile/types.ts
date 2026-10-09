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

// --- Nova family hub (local-only, no backend — see mobile/hooks/useFamily.ts etc.) ---

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
