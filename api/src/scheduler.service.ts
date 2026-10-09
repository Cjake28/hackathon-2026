import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import type { Alarm } from '@prisma/client';
import { nextAt, notify, speak } from './family';
import { PrismaService } from './prisma.service';

const TICK_MS = 10_000;
const REPEAT_MS = 60_000; // while ringing, the hub says it again every minute
const RING_MS = 10 * 60_000; // nobody dismissed it in 10 min (or it was missed while the hub was off): stop

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
      include: { user: { select: { name: true } } },
    });
    for (const { user, ...alarm } of alarms) {
      if (now - (alarm.ringingAt ?? alarm.nextAt).getTime() > RING_MS) {
        await this.prisma.alarm.update({ where: { id: alarm.id }, data: stopRinging(alarm) });
        continue;
      }
      if (!alarm.ringingAt) {
        await this.prisma.alarm.update({ where: { id: alarm.id }, data: { ringingAt: new Date(now) } });
        await notify(this.prisma, alarm.userId, 'alarm:ring', alarm.label, { alarmId: alarm.id });
      } else if (now - (this.spokenAt.get(alarm.id) ?? 0) < REPEAT_MS) {
        continue;
      }
      this.spokenAt.set(alarm.id, now);
      speak(`${user.name}, ${alarm.label}!`);
    }
  }
}
