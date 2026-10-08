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

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// RAG
export type RagDocument = {
  id: number;
  title: string;
  source: string;
  createdAt: string;
  _count: { chunks: number };
};

export type AskResult = {
  answer: string;
  sources: { n: number; documentId: number; title: string; page: number | null; snippet: string; score: number }[];
};
