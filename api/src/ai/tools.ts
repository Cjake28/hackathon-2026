import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission, type Permission } from '../auth/permissions';
import { briefingFacts, say, sayTime } from '../briefing/briefing-facts';
import { assertCanActFor, findPerson, nextAt, notify, speak } from '../family';
import { distanceM, sayDistance } from '../location/geo';
import { driveMinutes, placeName } from '../location/google';
import type { PrismaService } from '../prisma.service';
import type { RagService } from '../rag/rag.service';
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
  // Runs before a confirm: true tool is proposed. Throw (e.g. ForbiddenException) to refuse right away instead of
  // after the user says yes. run() must still re-check: permissions can change before the Confirm.
  check?: (args: z.infer<T>, deps: Deps) => Promise<unknown>;
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

  // ---- Family hub (TEAM-PLAN.md 4.6). Owner: Brain dev. ----
  tool({
    name: 'set_alarm',
    description: 'Set an alarm or reminder for someone. Use inMinutes for "in 10 minutes", time for a clock time.',
    params: z.object({
      person: z.string().optional().describe('Who it rings for. Leave empty for the speaker'),
      time: z.string().optional().describe('Clock time, e.g. "06:30" or "6:30 pm"'),
      inMinutes: z.number().int().min(1).max(1440).optional(),
      label: z.string().optional().describe('e.g. "Wake up", "Take medicine", "Leave for school"'),
      repeat: z.enum(['once', 'daily', 'weekdays']).optional(),
      kind: z.enum(['alarm', 'reminder']).optional(),
    }),
    permission: 'alarms.own',
    confirm: true,
    describe: (a) =>
      `${a.kind === 'reminder' ? 'Set a reminder' : 'Set an alarm'} "${a.label ?? (a.kind === 'reminder' ? 'Reminder' : 'Alarm')}" ` +
      `for ${a.person ?? 'you'} ${when(a)}`,
    check: async (a, { prisma, user }) => {
      const p = await person(prisma, a.person, user);
      assertCanActFor(user, p.id, 'alarms.family');
      if (!a.inMinutes && !parseTime(a.time)) throw new BadRequestException('What time? Say a time like 6:30 AM, or "in 10 minutes".');
    },
    run: async (a, { prisma, user }) => {
      const p = await person(prisma, a.person, user);
      assertCanActFor(user, p.id, 'alarms.family');
      const kind = a.kind ?? 'alarm';
      const label = a.label ?? (kind === 'reminder' ? 'Reminder' : 'Alarm');
      const data = { userId: p.id, createdById: user.id, kind, label };
      if (a.inMinutes) {
        const at = new Date(Date.now() + a.inMinutes * 60_000);
        return prisma.alarm.create({ data: { ...data, time: hhmm(at), repeat: 'once', nextAt: at } });
      }
      const time = parseTime(a.time);
      if (!time) throw new BadRequestException('What time? Say a time like 6:30 AM, or "in 10 minutes".');
      const repeat = a.repeat ?? 'once';
      return prisma.alarm.create({ data: { ...data, time, repeat, nextAt: nextAt(time, repeat) } });
    },
  }),
  tool({
    name: 'list_alarms',
    description: "List someone's alarms and reminders with their id and who set them.",
    params: z.object({ person: z.string().optional().describe('Leave empty for the speaker') }),
    permission: 'alarms.own',
    confirm: false,
    run: async ({ person: name }, { prisma, user }) => {
      const p = await person(prisma, name, user);
      assertCanActFor(user, p.id, 'alarms.family');
      const [alarms, names] = await Promise.all([
        prisma.alarm.findMany({ where: { userId: p.id }, orderBy: { nextAt: 'asc' } }),
        nameById(prisma),
      ]);
      if (!alarms.length) return `${p.name} has no alarms or reminders.`;
      return alarms.map((a) => ({
        id: a.id, kind: a.kind, label: a.label, time: pretty(a.time), repeat: a.repeat, on: a.enabled,
        setBy: names[a.createdById],
      }));
    },
  }),
  tool({
    name: 'cancel_alarm',
    description: 'Delete an alarm or reminder by its id (use list_alarms first to find the id).',
    params: z.object({ id: z.number().int() }),
    permission: 'alarms.own',
    confirm: true,
    describe: ({ id }) => `Delete alarm #${id}`,
    check: ({ id }, { prisma, user }) => alarmICanChange(prisma, user, id),
    run: async ({ id }, { prisma, user }) => {
      await alarmICanChange(prisma, user, id);
      return prisma.alarm.delete({ where: { id } });
    },
  }),
  tool({
    name: 'give_task',
    description: 'Give a task or a house chore to a family member. Chores are checked with before and after photos.',
    params: z.object({
      person: z.string(),
      title: z.string().describe('Short, e.g. "Wash the dishes"'),
      isChore: z.boolean().optional().describe('true for house chores'),
    }),
    permission: 'tasks.assign',
    confirm: true,
    describe: ({ person, title, isChore }) => `Give ${person} a ${isChore ? 'chore' : 'task'}: ${title}`,
    check: ({ person: name }, { prisma, user }) => person(prisma, name, user),
    run: async ({ person: name, title, isChore }, { prisma, user }) => {
      const p = await person(prisma, name, user);
      const task = await prisma.task.create({ data: { title, assigneeId: p.id, createdById: user.id, isChore: !!isChore } });
      await notify(prisma, p.id, 'task:new', `${user.name}: ${title}`, { taskId: task.id });
      speak(`${p.name}, ${user.name} gave you a ${isChore ? 'chore' : 'task'}: ${title}`);
      return task;
    },
  }),
  tool({
    name: 'list_tasks',
    description: "List someone's tasks and chores with their status.",
    params: z.object({ person: z.string().optional().describe('Leave empty for the speaker') }),
    permission: 'tasks.own',
    confirm: false,
    run: async ({ person: name }, { prisma, user }) => {
      const p = await person(prisma, name, user);
      assertCanActFor(user, p.id, 'tasks.assign');
      const tasks = await prisma.task.findMany({ where: { assigneeId: p.id }, orderBy: { createdAt: 'desc' }, take: 20 });
      if (!tasks.length) return `${p.name} has no tasks.`;
      return tasks.map((t) => ({ id: t.id, title: t.title, status: t.status, chore: t.isChore, feedback: t.feedback }));
    },
  }),
  tool({
    name: 'list_events',
    description: 'List family calendar events.',
    params: z.object({ day: z.enum(['today', 'tomorrow', 'week']).optional() }),
    permission: 'calendar.use',
    confirm: false,
    run: async ({ day = 'week' }, { prisma }) => {
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      if (day === 'tomorrow') from.setDate(from.getDate() + 1);
      const to = new Date(from);
      to.setDate(to.getDate() + (day === 'week' ? 7 : 1));
      const [events, names] = await Promise.all([
        prisma.event.findMany({ where: { startsAt: { gte: from, lt: to } }, orderBy: { startsAt: 'asc' } }),
        nameById(prisma),
      ]);
      if (!events.length) return 'No events.';
      return events.map((e) => ({ title: e.title, when: say(e.startsAt), who: e.userId ? names[e.userId] : 'whole family' }));
    },
  }),
  tool({
    name: 'add_event',
    description: 'Add an event to the family calendar.',
    params: z.object({
      title: z.string(),
      startsAt: z.string().describe('Local date and time, e.g. 2026-10-11T16:00'),
      person: z.string().optional().describe('Leave empty for the whole family'),
    }),
    permission: 'calendar.use',
    confirm: true,
    describe: ({ title, startsAt }) => `Add "${title}" to the calendar on ${validDate(startsAt) ? say(new Date(startsAt)) : startsAt}`,
    check: async ({ startsAt, person: name }, { prisma, user }) => {
      if (!validDate(startsAt)) throw new BadRequestException('When is it? Say a day and a time.');
      if (name) await person(prisma, name, user);
    },
    run: async ({ title, startsAt, person: name }, { prisma, user }) => {
      if (!validDate(startsAt)) throw new BadRequestException('When is it? Say a day and a time.');
      const p = name ? await person(prisma, name, user) : null;
      return prisma.event.create({ data: { title, startsAt: new Date(startsAt), userId: p?.id ?? null, createdById: user.id } });
    },
  }),
  tool({
    name: 'budget_summary',
    description: "This month's family spending in pesos: total, monthly limit and by category.",
    params: z.object({}),
    permission: 'budget.use',
    confirm: false,
    run: async (_args, { prisma }) => {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const [expenses, limit] = await Promise.all([
        prisma.expense.findMany({ where: { spentAt: { gte: start } } }),
        prisma.setting.findUnique({ where: { key: 'budget.monthly' } }),
      ]);
      const byCategory: Record<string, number> = {};
      for (const e of expenses) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
      const total = expenses.reduce((sum, e) => sum + e.amount, 0);
      return { month: start.toLocaleString('en-US', { month: 'long' }), totalPesos: total, limitPesos: limit ? Number(limit.value) : null, byCategory };
    },
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
    describe: ({ amount, category, note }) => `Add an expense of ${amount} pesos for ${category}${note ? ` (${note})` : ''}`,
    run: ({ amount, category, note }, { prisma, user }) =>
      prisma.expense.create({ data: { amount, category, note: note ?? '', addedById: user.id } }),
  }),
  tool({
    name: 'who_is_home',
    description: 'Which family members are home right now.',
    params: z.object({}),
    permission: 'presence.read',
    confirm: false,
    run: async (_args, { prisma }) => {
      const since = new Date(Date.now() - 2 * 60_000); // same rule as GET /api/device/poll
      const people = await prisma.user.findMany({ where: { role: { name: { in: ['parent', 'child'] } } }, orderBy: { id: 'asc' } });
      return people.map((p) => `${p.name}: ${p.lastSeenAt && p.lastSeenAt >= since ? 'home' : 'away'}`).join(', ');
    },
  }),
  tool({
    name: 'where_is',
    description: 'Where a family member is right now (from their phone).',
    params: z.object({ person: z.string() }),
    permission: 'location.read',
    confirm: false,
    run: async ({ person: name }, { prisma, user }) => {
      const p = await person(prisma, name, user);
      const [loc, places] = await Promise.all([prisma.location.findUnique({ where: { userId: p.id } }), prisma.place.findMany()]);
      if (!loc) return `${p.name} hasn't shared a location yet.`;
      const ago = Math.round((Date.now() - loc.updatedAt.getTime()) / 60_000);
      const updated = ago < 1 ? 'just now' : `${ago} minutes ago`;
      const place = places.find((pl) => pl.id === loc.placeId);
      if (place) return `${p.name} is at ${place.name} since ${sayTime(loc.since)} (updated ${updated}).`;
      // Not at a saved place: with GOOGLE_MAPS_KEY, a real place name + driving time home (#57).
      const home = places.find((pl) => /^home$/i.test(pl.name));
      const [near, minutes] = await Promise.all([placeName(loc), home ? driveMinutes(loc, home) : null]);
      const nearest = places.map((pl) => ({ pl, d: distanceM(loc, pl) })).sort((a, b) => a.d - b.d)[0];
      const where = near ? `near ${near}` : nearest ? `about ${sayDistance(nearest.d)} from ${nearest.pl.name}` : 'away';
      const eta = minutes ? `, about ${minutes} minutes from Home by car` : '';
      return `${p.name} is ${where}${eta} (updated ${updated}).`;
    },
  }),
  tool({
    name: 'remember',
    description: 'Remember a fact about the speaker (likes, allergies, routines) for later.',
    params: z.object({ text: z.string().describe('Short, e.g. "likes adobo"') }),
    permission: 'memory.own',
    confirm: true,
    describe: ({ text }) => `Remember: ${text}`,
    run: ({ text }, { prisma, user }) => prisma.memoryNote.create({ data: { userId: user.id, text } }),
  }),
  tool({
    name: 'morning_briefing',
    description: "The speaker's day: alarms, events, tasks and grocery list. Use for 'good morning' or 'what's my day'.",
    params: z.object({}),
    permission: 'ai.use',
    confirm: false,
    run: (_args, { prisma, user }) => briefingFacts(prisma, user),
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

// Runs a tool's check (if any) before it is proposed. Throws when the user may not do it.
export async function checkTool(t: AnyTool, args: unknown, deps: Deps) {
  const check = t.check as ((args: unknown, deps: Deps) => Promise<unknown>) | undefined;
  if (check) await check((t.params as z.ZodType).parse(args), deps);
}

// ---- helpers for the family tools ----

// What people (and speech-to-text) call the parents.
const NICKNAMES: Record<string, string[]> = {
  mom: ['mom', 'mommy', 'mum', 'mama', 'ma', 'nanay', 'inay', 'mother'],
  dad: ['dad', 'daddy', 'papa', 'pa', 'tatay', 'itay', 'father'],
};
// "Anna" → "ana", "Benn" → "ben": speech-to-text doubles letters in names.
const squash = (s: string) => s.toLowerCase().replace(/(.)\1+/g, '$1');

// findPerson(), plus what small models and speech-to-text write instead of the exact name:
// "my daughter Ana", "Ana's", "mama" → Mom, "papa" → Dad, "Anna" → Ana. Only a single clear match counts.
async function person(prisma: PrismaService, name: string | undefined, me: AuthUser) {
  if (!name || /^(i|my|mine|me|myself|ako|akin)$/i.test(name.trim())) return findPerson(prisma, undefined, me);
  try {
    return await findPerson(prisma, name, me);
  } catch (error) {
    const users = await prisma.user.findMany({ where: { role: { name: { not: 'guest' } } } });
    const words = name.toLowerCase().replace(/'s\b/g, '').split(/[^\p{L}]+/u).filter(Boolean);
    const only = (matches: typeof users) => (matches.length === 1 ? matches[0] : undefined);
    const found =
      only(users.filter((u) => words.includes(u.name.toLowerCase()))) ??
      only(users.filter((u) => words.some((w) => NICKNAMES[u.name.toLowerCase()]?.includes(w)))) ??
      only(users.filter((u) => words.some((w) => w.length >= 3 && squash(w) === squash(u.name))));
    if (found) return found;
    throw error;
  }
}

// A child can't delete an alarm a parent set (the demo's "Sorry Ana, Mom set that one").
export async function alarmICanChange(prisma: PrismaService, user: AuthUser, id: number) {
  const alarm = await prisma.alarm.findUnique({ where: { id } });
  if (!alarm) throw new NotFoundException(`There is no alarm number ${id}.`);
  const parent = hasPermission(user.permissions, 'alarms.family');
  if (alarm.userId !== user.id && !parent) throw new ForbiddenException("That's not your alarm.");
  if (alarm.createdById !== user.id && !parent) {
    const creator = await prisma.user.findUnique({ where: { id: alarm.createdById } });
    throw new ForbiddenException(`${creator?.name ?? 'A parent'} set that alarm, so only a parent can remove it.`);
  }
  return alarm;
}

async function nameById(prisma: PrismaService) {
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  return Object.fromEntries(users.map((u) => [u.id, u.name])) as Record<number, string>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const validDate = (s: string) => !Number.isNaN(new Date(s).getTime());

// "6:30", "6:30 am", "6 pm", "18:00", "6.30 p.m." → "06:30" / "18:00" (null if it isn't a time)
function parseTime(raw?: string) {
  const m = raw?.trim().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  const half = m[3]?.[0].toLowerCase();
  if (half === 'p' && h < 12) h += 12;
  if (half === 'a' && h === 12) h = 0;
  return h > 23 || min > 59 ? null : `${pad(h)}:${pad(min)}`;
}

// "06:30" → "6:30 AM"
function pretty(time: string) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return sayTime(d);
}

function when(a: { time?: string; inMinutes?: number; repeat?: string }) {
  if (a.inMinutes) return `in ${a.inMinutes} minute${a.inMinutes === 1 ? '' : 's'}`;
  const time = parseTime(a.time);
  const repeat = a.repeat === 'daily' ? ' every day' : a.repeat === 'weekdays' ? ' on weekdays' : '';
  return `at ${time ? pretty(time) : a.time}${repeat}`;
}
