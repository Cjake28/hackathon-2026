// Every permission in the app. Add new ones here AND in types.ts in web/ and mobile/.
export const PERMISSIONS = [
  'items.read',
  'items.create',
  'items.update',
  'items.delete',
  'users.manage',
  'roles.manage',
  'ai.use', // AI chat, AI features, asking the documents
  'docs.manage', // upload/delete RAG documents
] as const;

export type Permission = (typeof PERMISSIONS)[number];

// Role given to new sign-ups. The seeded "admin" role has "*" (every permission).
export const DEFAULT_ROLE = 'user';

// New accounts whose email is in ADMIN_EMAILS (comma-separated, api/.env) start as admin.
export const roleForNewUser = (email: string) =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .includes(email.toLowerCase())
    ? 'admin'
    : DEFAULT_ROLE;

export const hasPermission = (permissions: string[], permission: Permission) =>
  permissions.includes('*') || permissions.includes(permission);
