import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { FAKE_ALARMS } from '../fake';
import { PrismaService } from '../prisma.service';

type AlarmInput = {
  userId?: number; // default: me. Someone else needs alarms.family (use assertCanActFor from family.ts)
  kind?: 'alarm' | 'reminder';
  label?: string;
  time?: string; // "HH:mm"
  inMinutes?: number; // demo: ring N minutes from now
  repeat?: 'once' | 'daily' | 'weekdays';
};

// Owner: Hub dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #25 #28 #29
// Rule: a child can't delete or disable an alarm a parent created → 403 "Mom set that alarm."
@Controller('alarms')
@Can('alarms.own')
export class AlarmsController {
  constructor(private prisma: PrismaService) {}

  // ?userId= (someone else: alarms.family) or ?all=1 → Alarm[]
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('userId') userId?: string, @Query('all') all?: string) {
    return FAKE_ALARMS;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: AlarmInput) {
    return { ...FAKE_ALARMS[0], label: body.label ?? 'Alarm', time: body.time ?? '06:30' };
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: Partial<AlarmInput> & { enabled?: boolean }) {
    return { ...FAKE_ALARMS[0], id, ...body };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_ALARMS[0], id };
  }

  // Stops ringing. "once" → enabled false; repeats → nextAt moves forward.
  @Post(':id/dismiss')
  dismiss(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_ALARMS[0], id, ringingAt: null };
  }

  @Post(':id/snooze')
  snooze(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { minutes?: number }) {
    return { ...FAKE_ALARMS[0], id, ringingAt: null, nextAt: new Date(Date.now() + (body.minutes ?? 5) * 60_000).toISOString() };
  }
}
