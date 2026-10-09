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
  'ai.manage', // pick the hub's AI model (web AI Settings page)
  // Family hub (TEAM-PLAN.md 4.2)
  'alarms.own', // set/see/dismiss your own alarms and reminders
  'alarms.family', // set alarms/reminders for others (#28)
  'tasks.own', // see your tasks and check them off
  'tasks.assign', // give tasks to others, see everyone's
  'calendar.use',
  'budget.use',
  'presence.read', // who's home (never for guests)
  'memory.own', // Onai remembers things about you
  'location.share', // the phone sends its GPS (#51)
  'location.read', // see where everyone is, manage places (parents)
  'intercom.send', // "tell everyone dinner's ready" (#18): family, not guests
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
