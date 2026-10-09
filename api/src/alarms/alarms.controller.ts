import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { alarmICanChange } from '../ai/tools';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { briefOnWakeUp, isWakeUp } from '../briefing/wake-briefing';
import { assertCanActFor, nextAt } from '../family';
import { PrismaService } from '../prisma.service';
import { stopRinging } from '../scheduler.service';

type AlarmInput = {
  userId?: number; // default: me. Someone else needs alarms.family
  kind?: 'alarm' | 'reminder';
  label?: string;
  time?: string; // "HH:mm"
  inMinutes?: number; // demo: ring exactly N minutes from now
  repeat?: 'once' | 'daily' | 'weekdays';
};

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const validTime = (t?: string) => !!t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

// Owner: Hub dev. #25 #28 #29. The scheduler (scheduler.service.ts) rings them.
// Rule: a child can't change or delete an alarm a parent created → 403 (alarmICanChange, shared with voice).
@Controller('alarms')
@Can('alarms.own')
export class AlarmsController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService, // Brain: wake-up briefing on dismiss
  ) {}

  // Mine; ?userId= (someone else: alarms.family); ?all=1 (alarms.family) → Alarm[]
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('userId') userId?: string, @Query('all') all?: string) {
    if (all) {
      if (!hasPermission(user.permissions, 'alarms.family')) throw new ForbiddenException("Only a parent can see everyone's alarms");
      return this.prisma.alarm.findMany({ orderBy: { nextAt: 'asc' } });
    }
    const id = userId ? Number(userId) : user.id;
    assertCanActFor(user, id, 'alarms.family');
    return this.prisma.alarm.findMany({ where: { userId: id }, orderBy: { nextAt: 'asc' } });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: AlarmInput) {
    const userId = body.userId ?? user.id;
    assertCanActFor(user, userId, 'alarms.family');
    const kind = body.kind ?? 'alarm';
    const data = { userId, createdById: user.id, kind, label: body.label || (kind === 'reminder' ? 'Reminder' : 'Alarm') };
    // Same as the set_alarm tool: exactly now + N (nextAt() would zero the seconds).
    if (body.inMinutes) {
      const at = new Date(Date.now() + body.inMinutes * 60_000);
      return this.prisma.alarm.create({ data: { ...data, time: hhmm(at), repeat: 'once', nextAt: at } });
    }
    if (!validTime(body.time)) throw new BadRequestException('Send time as "HH:mm" (24h) or inMinutes');
    const repeat = body.repeat ?? 'once';
    return this.prisma.alarm.create({ data: { ...data, time: body.time!, repeat, nextAt: nextAt(body.time!, repeat) } });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { enabled?: boolean; label?: string; time?: string; repeat?: 'once' | 'daily' | 'weekdays' },
  ) {
    const alarm = await alarmICanChange(this.prisma, user, id);
    if (body.time !== undefined && !validTime(body.time)) throw new BadRequestException('Send time as "HH:mm" (24h)');
    const time = body.time ?? alarm.time;
    const repeat = body.repeat ?? alarm.repeat;
    const enabled = body.enabled ?? alarm.enabled;
    // New time, new repeat or switched back on → next ring from now. Switched off → stop ringing.
    const reschedule = body.time !== undefined || body.repeat !== undefined || (enabled && !alarm.enabled);
    return this.prisma.alarm.update({
      where: { id },
      data: {
        label: body.label,
        time,
        repeat,
        enabled,
        ...(reschedule ? { nextAt: nextAt(time, repeat), ringingAt: null } : {}),
        ...(!enabled ? { ringingAt: null } : {}),
      },
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await alarmICanChange(this.prisma, user, id);
    return this.prisma.alarm.delete({ where: { id } });
  }

  // Stops ringing. "once" → enabled false; repeats → nextAt moves forward. Ana may dismiss the alarm Mom set.
  @Post(':id/dismiss')
  async dismiss(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const alarm = await this.ringsFor(user, id);
    if (alarm.ringingAt && isWakeUp(alarm)) briefOnWakeUp(this.prisma, this.ai, alarm.userId); // Brain: good-morning briefing
    return this.prisma.alarm.update({ where: { id }, data: stopRinging(alarm) });
  }

  @Post(':id/snooze')
  async snooze(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body?: { minutes?: number }) {
    await this.ringsFor(user, id);
    const at = new Date(Date.now() + (body?.minutes || 5) * 60_000);
    return this.prisma.alarm.update({ where: { id }, data: { ringingAt: null, enabled: true, nextAt: at } });
  }

  // My alarm (whoever set it), or anyone's with alarms.family.
  private async ringsFor(user: AuthUser, id: number) {
    const alarm = await this.prisma.alarm.findUniqueOrThrow({ where: { id } });
    assertCanActFor(user, alarm.userId, 'alarms.family');
    return alarm;
  }
}
