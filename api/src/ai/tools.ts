import { z } from 'zod';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission, type Permission } from '../auth/permissions';
import type { PrismaService } from '../prisma.service';
import type { RagService } from '../rag/rag.service';
import { FAKE_ALARMS, FAKE_BRIEFING, FAKE_BUDGET, FAKE_EVENTS, FAKE_PEOPLE, FAKE_TASKS } from '../fake';
import type { AiTool } from './ai.service';

type Deps = { prisma: PrismaService; rag: RagService; user: AuthUser };

// A tool the AI may use in chats with "Allow app actions" on. Only users with `permission` get it.
// confirm: false → runs right away (read-only). confirm: true → the AI only proposes it and it runs after the
// user taps Confirm. Anything that changes data must be confirm: true.
type AppTool<T extends z.ZodObject> = {
  name: string;
  description: string;
  params: T;
  permission: Permission;
  confirm: boolean;
  describe?: (args: z.infer<T>) => string; // what the Confirm card says
  run: (args: z.infer<T>, deps: Deps) => Promise<unknown>;
};

const tool = <T extends z.ZodObject>(t: AppTool<T>) => t;

// Add your feature's tools here.
export const TOOLS = [
  tool({
    name: 'search_documents',
    description: "Search the user's uploaded documents (handbooks, modules, notes) for facts.",
    params: z.object({ query: z.string() }),
    permission: 'ai.use',
    confirm: false,
    run: async ({ query }, { rag }) => (await rag.search(query)).context || 'Nothing found in the documents.',
  }),
  tool({
    name: 'list_items',
    description: 'List the family grocery list: id, name and whether it was bought.',
    params: z.object({}),
    permission: 'items.read',
    confirm: false,
    run: (_args, { prisma }) =>
      prisma.item.findMany({ orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, done: true } }),
  }),
  tool({
    name: 'create_items',
    description: 'Add one or more things to the family grocery list.',
    params: z.object({ names: z.array(z.string()).min(1).max(10) }),
    permission: 'items.create',
    confirm: true,
    describe: ({ names }) => `Add to the grocery list: ${names.join(', ')}`,
    run: ({ names }, { prisma }) => prisma.item.createManyAndReturn({ data: names.map((name) => ({ name })) }),
  }),
  tool({
    name: 'set_item_done',
    description: 'Mark a grocery list item as bought or not, by its id (use list_items to find the id).',
    params: z.object({ id: z.number().int(), done: z.boolean() }),
    permission: 'items.update',
    confirm: true,
    describe: ({ id, done }) => `Mark grocery item #${id} as ${done ? 'bought' : 'not bought'}`,
    run: ({ id, done }, { prisma }) => prisma.item.update({ where: { id }, data: { done } }),
  }),

  // ---- Family hub (TEAM-PLAN.md 4.6). Owner: Brain dev. STUB run()s return fake data. ----
  // Real versions: resolve names with findPerson(), check assertCanActFor() (api/src/family.ts), then prisma.
  tool({
    name: 'set_alarm',
    description:
      'Set an alarm or reminder for someone. Use inMinutes for "in 10 minutes", time (HH:mm, 24-hour) for a clock time.',
    params: z.object({
      person: z.string().optional().describe('Name, or leave empty for the speaker'),
      time: z.string().optional().describe('"06:30" or "18:00"'),
      inMinutes: z.number().int().min(1).max(1440).optional(),
      label: z.string().optional().describe('"Wake up", "Take medicine", "Leave for school"'),
      repeat: z.enum(['once', 'daily', 'weekdays']).optional(),
      kind: z.enum(['alarm', 'reminder']).optional(),
    }),
    permission: 'alarms.own',
    confirm: true,
    describe: (a) =>
      `Set a ${a.kind ?? 'alarm'} "${a.label ?? 'Alarm'}" for ${a.person ?? 'you'} ${a.inMinutes ? `in ${a.inMinutes} min` : `at ${a.time}`}`,
    run: async () => FAKE_ALARMS[0],
  }),
  tool({
    name: 'list_alarms',
    description: "List someone's alarms and reminders with their id.",
    params: z.object({ person: z.string().optional() }),
    permission: 'alarms.own',
    confirm: false,
    run: async () => FAKE_ALARMS,
  }),
  tool({
    name: 'cancel_alarm',
    description: 'Delete an alarm or reminder by its id (use list_alarms to find the id).',
    params: z.object({ id: z.number().int() }),
    permission: 'alarms.own',
    confirm: true,
    describe: ({ id }) => `Delete alarm #${id}`,
    run: async ({ id }) => ({ ...FAKE_ALARMS[0], id }),
  }),
  tool({
    name: 'give_task',
    description: 'Give a task or chore to a family member. Chores are checked with before and after photos.',
    params: z.object({ person: z.string(), title: z.string(), isChore: z.boolean().optional() }),
    permission: 'tasks.assign',
    confirm: true,
    describe: ({ person, title, isChore }) => `Give ${person} a ${isChore ? 'chore' : 'task'}: ${title}`,
    run: async ({ title }) => ({ ...FAKE_TASKS[0], title }),
  }),
  tool({
    name: 'list_tasks',
    description: "List someone's tasks and chores with their status.",
    params: z.object({ person: z.string().optional() }),
    permission: 'tasks.own',
    confirm: false,
    run: async () => FAKE_TASKS,
  }),
  tool({
    name: 'list_events',
    description: 'List family calendar events.',
    params: z.object({ day: z.enum(['today', 'tomorrow', 'week']).optional() }),
    permission: 'calendar.use',
    confirm: false,
    run: async () => FAKE_EVENTS,
  }),
  tool({
    name: 'add_event',
    description: 'Add an event to the family calendar.',
    params: z.object({
      title: z.string(),
      startsAt: z.string().describe('ISO date and time, e.g. 2026-10-11T16:00'),
      person: z.string().optional().describe('Leave empty for the whole family'),
    }),
    permission: 'calendar.use',
    confirm: true,
    describe: ({ title, startsAt }) => `Add "${title}" to the calendar on ${startsAt}`,
    run: async ({ title, startsAt }) => ({ ...FAKE_EVENTS[0], title, startsAt }),
  }),
  tool({
    name: 'budget_summary',
    description: "This month's family spending: total, limit and by category (pesos).",
    params: z.object({}),
    permission: 'budget.use',
    confirm: false,
    run: async () => FAKE_BUDGET,
  }),
  tool({
    name: 'add_expense',
    description: 'Record money the family spent, in pesos.',
    params: z.object({
      amount: z.number().positive(),
      category: z.enum(['food', 'bills', 'school', 'transport', 'other']),
      note: z.string().optional(),
    }),
    permission: 'budget.use',
    confirm: true,
    describe: ({ amount, category }) => `Add an expense: ₱${amount} for ${category}`,
    run: async ({ amount, category }) => ({ id: 99, amount, category }),
  }),
  tool({
    name: 'who_is_home',
    description: 'Which family members are home right now.',
    params: z.object({}),
    permission: 'presence.read',
    confirm: false,
    run: async () => FAKE_PEOPLE.filter((p) => p.isHome).map((p) => p.name),
  }),
  tool({
    name: 'remember',
    description: 'Remember a fact about the speaker (likes, allergies, routines) for later.',
    params: z.object({ text: z.string() }),
    permission: 'memory.own',
    confirm: true,
    describe: ({ text }) => `Remember: ${text}`,
    run: async ({ text }) => ({ id: 99, text }),
  }),
  tool({
    name: 'morning_briefing',
    description: "The speaker's day: alarms, events, tasks and grocery list. Use for 'good morning' or 'what's my day'.",
    params: z.object({}),
    permission: 'ai.use',
    confirm: false,
    run: async () => FAKE_BRIEFING,
  }),
];

export type AnyTool = (typeof TOOLS)[number];

export const toolsFor = (user: AuthUser) => TOOLS.filter((t) => hasPermission(user.permissions, t.permission));

// The format Ollama expects.
export const toolSpecs = (tools: AnyTool[]): AiTool[] =>
  tools.map((t) => {
    const { $schema, ...parameters } = z.toJSONSchema(t.params) as Record<string, unknown>;
    return { type: 'function', function: { name: t.name, description: t.description, parameters } };
  });

// Validates the AI's arguments and runs the tool (callers check `confirm` first).
export async function runTool(t: AnyTool, args: unknown, deps: Deps) {
  const parsed = (t.params as z.ZodType).parse(args);
  return (t.run as (args: unknown, deps: Deps) => Promise<unknown>)(parsed, deps);
}
