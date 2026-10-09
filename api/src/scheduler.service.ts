import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Alarm } from '@prisma/client';
import { syncGoogle } from './calendar/google-calendar';
import { nextAt, notify, speak } from './family';
import { PrismaService } from './prisma.service';

const TICK_MS = 10_000;
const REPEAT_MS = 60_000; // while ringing, the hub says it again every minute
const RING_MS = 10 * 60_000; // nobody dismissed it in 10 min (or it was missed while the hub was off): stop
const ESCALATE_MS = 2 * 60_000; // Brain (#27): a kid's alarm still ringing after 2 min → tell the parents
const EVENT_SOON_MS = 15 * 60_000; // calendar: a heads-up 15 min before each event

// Dismissed, or rang too long: a one-time alarm turns off, a repeating one moves to its next time.
export const stopRinging = (a: Alarm) =>
  a.repeat === 'once'
    ? { ringingAt: null, enabled: false }
    : { ringingAt: null, nextAt: nextAt(a.time, a.repeat) };

// Owner: Hub dev. Rings alarms and reminders (#25 #29). Every 10 s: due alarms start ringing → alarm:ring notice
// (devices pick it up from GET /api/device/poll) + the hub says "<Name>, <label>!", again every minute until
// dismissed or snoozed.
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private spokenAt = new Map<number, number>(); // alarm id → when the hub last said it
  private escalated = new Set<string>(); // "alarmId:ringingAt" already told to the parents
  private remindedEvents = new Set<string>(); // "eventId:startsAt" already announced (a moved event gets a new one)

  constructor(private prisma: PrismaService) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.tick().catch(() => {}), TICK_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  private async tick() {
    const now = Date.now();
    const alarms = await this.prisma.alarm.findMany({
      where: { OR: [{ ringingAt: { not: null } }, { enabled: true, nextAt: { lte: new Date(now) } }] },
      include: { user: { select: { name: true, role: { select: { name: true } } } } },
    });
    for (const { user, ...alarm } of alarms) {
      if (now - (alarm.ringingAt ?? alarm.nextAt).getTime() > RING_MS) {
        await this.prisma.alarm.update({ where: { id: alarm.id }, data: stopRinging(alarm) });
        continue;
      }
      if (!alarm.ringingAt) {
        await this.prisma.alarm.update({ where: { id: alarm.id }, data: { ringingAt: new Date(now) } });
        await notify(this.prisma, alarm.userId, 'alarm:ring', alarm.label, { alarmId: alarm.id });
      } else if (user.role.name === 'child' && now - alarm.ringingAt.getTime() >= ESCALATE_MS) {
        await this.escalate(alarm, user.name);
      }
      if (alarm.ringingAt && now - (this.spokenAt.get(alarm.id) ?? 0) < REPEAT_MS) {
        continue;
      }
      this.spokenAt.set(alarm.id, now);
      speak(`${user.name}, ${alarm.label}!`);
    }
    await this.remindEvents(now);
    void syncGoogle(this.prisma).catch(() => {}); // calendar copies in Google; not awaited: alarms never wait for Google
  }

  // 15 min before a calendar event: an event:soon notice on that person's devices (every family device for a family
  // event) + the hub says it: "Ana, piano lesson in 15 minutes." Kept in memory: a restart in those 15 min may say it twice.
  private async remindEvents(now: number) {
    const events = await this.prisma.event.findMany({
      where: { startsAt: { gt: new Date(now), lte: new Date(now + EVENT_SOON_MS) } },
    });
    for (const event of events) {
      const key = `${event.id}:${event.startsAt.getTime()}`;
      if (this.remindedEvents.has(key)) continue;
      this.remindedEvents.add(key);
      const minutes = Math.max(1, Math.round((event.startsAt.getTime() - now) / 60_000));
      const who = event.userId
        ? (await this.prisma.user.findUnique({ where: { id: event.userId }, select: { name: true } }))?.name
        : null;
      const text = `${who ? `${who}, ` : 'Reminder: '}${event.title} in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
      await notify(this.prisma, event.userId, 'event:soon', text, { eventId: event.id });
      speak(text);
    }
  }

  // Brain (#27): once per ringing, the parents' phones get "Ana's alarm has been ringing for 2 minutes" and the hub says it.
  private async escalate(alarm: Alarm, name: string) {
    const key = `${alarm.id}:${alarm.ringingAt?.getTime()}`;
    if (this.escalated.has(key)) return;
    this.escalated.add(key);
    const text = `${name}'s alarm has been ringing for 2 minutes.`;
    const parents = await this.prisma.user.findMany({ where: { role: { name: 'parent' } } });
    for (const p of parents) await notify(this.prisma, p.id, 'alarm:ignored', text, { alarmId: alarm.id, userId: alarm.userId });
    speak(text);
  }
}
