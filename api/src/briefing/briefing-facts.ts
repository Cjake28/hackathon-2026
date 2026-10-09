import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { pointsFor } from '../chores/points';
import type { PrismaService } from '../prisma.service';

// Hub local time, the way Onai says it: "Saturday, October 10, 4:00 PM".
export const say = (d: Date) =>
  d.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export const sayTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

// How the AI turns briefingFacts() into speech (GET /api/briefing and "good morning, Onai").
export const BRIEFING_SYSTEM =
  'You are Onai, a warm family home assistant. Turn the facts into a spoken good-morning briefing: 2 to 4 short ' +
  'sentences, plain text, no lists, no markdown. Use only the facts given. Skip anything that is "none".';

// Everything the morning briefing (#30) can talk about, as plain facts for the AI. Used by GET /api/briefing and
// the morning_briefing tool.
export async function briefingFacts(prisma: PrismaService, user: AuthUser) {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const in24h = new Date(now.getTime() + 24 * 3600_000);

  const [alarms, events, tasks, grocery, memory, score] = await Promise.all([
    prisma.alarm.findMany({
      where: { userId: user.id, enabled: true, nextAt: { lte: in24h } },
      orderBy: { nextAt: 'asc' },
    }),
    prisma.event.findMany({
      where: { startsAt: { gte: startOfDay, lte: endOfDay }, OR: [{ userId: null }, { userId: user.id }] },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.task.findMany({ where: { assigneeId: user.id, status: { not: 'done' } }, orderBy: { createdAt: 'asc' } }),
    hasPermission(user.permissions, 'items.read') ? prisma.item.findMany({ where: { done: false }, take: 10 }) : [],
    prisma.memoryNote.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 10 }),
    pointsFor(prisma, user.id),
  ]);

  const list = (items: string[], empty: string) => (items.length ? items.join('; ') : empty);
  return [
    `Person: ${user.name}. Now: ${say(now)}.`,
    `Alarms and reminders in the next 24 hours: ${list(alarms.map((a) => `${a.label} at ${sayTime(a.nextAt)}`), 'none')}.`,
    `Events today: ${list(events.map((e) => `${e.title} at ${sayTime(e.startsAt)}`), 'none')}.`,
    `Tasks not done yet: ${list(tasks.map((t) => `${t.title}${t.isChore ? ' (chore)' : ''}${t.status === 'redo' ? ' (needs redo)' : ''}`), 'none')}.`,
    ...(hasPermission(user.permissions, 'items.read')
      ? [`Grocery list: ${list(grocery.map((i) => i.name), 'empty')}.`]
      : []),
    `What ${user.name} likes or does: ${list(memory.map((m) => m.text), 'nothing saved')}.`,
    `Reward points: ${score.points} (${score.choresDone} chores approved).`,
  ].join('\n');
}
