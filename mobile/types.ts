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
