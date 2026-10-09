import { Body, ConflictException, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';
import {
  checkCalendar,
  dropChallenge,
  familyCalendar,
  finishChallenge,
  googleEnabled,
  googleShareWith,
  pendingCalendar,
  resyncEvents,
  setFamilyCalendar,
  startChallenge,
} from './google-calendar';

const calendarIdOf = (body?: { calendarId?: string }) => body?.calendarId?.trim().toLowerCase() || null;

// Owner: Hub dev. "Google Calendar" in the app's Settings: connect your own Google Calendar (and, for parents, the
// family one), so the events Jarvis adds also show up there. How it works: google-calendar.ts, docs/google-calendar.md.
// Connecting your own calendar takes two steps: PATCH /google/me (the hub puts a one-time code in that calendar), then
// PATCH /google/me/verify with the code. Only someone who can see the calendar can read it.
@Controller('google')
@Can('calendar.use')
export class GoogleController {
  constructor(private prisma: PrismaService) {}

  // → { enabled, shareWith, mine, pending, family }. shareWith: the address to share your calendar with.
  // pending: the calendar waiting for its code.
  @Get()
  async status(@CurrentUser() user: AuthUser) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { googleCalendarId: true } });
    return {
      enabled: googleEnabled(),
      shareWith: googleShareWith(),
      mine: me.googleCalendarId,
      pending: pendingCalendar(user.id),
      family: await familyCalendar(this.prisma),
    };
  }

  // Step 1. { calendarId: "ana.cruz@gmail.com" } → checks it was shared with the hub, then puts "Jarvis code: …" in it.
  // "" disconnects right away (and removes the copies Jarvis made).
  @Patch('me')
  async connectMine(@CurrentUser() user: AuthUser, @Body() body?: { calendarId?: string }) {
    const calendarId = calendarIdOf(body);
    if (!calendarId) {
      await dropChallenge(user.id);
      await this.prisma.user.update({ where: { id: user.id }, data: { googleCalendarId: null } });
      await resyncEvents(this.prisma, { userId: user.id });
      return this.status(user);
    }
    await checkCalendar(calendarId);
    await this.assertFree(calendarId, user.id);
    await startChallenge(user.id, calendarId);
    return this.status(user);
  }

  // Step 2. { code: "482913" } from the "Jarvis code" event in that calendar → connected.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Patch('me/verify')
  async verifyMine(@CurrentUser() user: AuthUser, @Body() body?: { code?: string }) {
    const calendarId = await finishChallenge(user.id, String(body?.code ?? ''));
    await this.assertFree(calendarId, user.id);
    await this.prisma.user.update({ where: { id: user.id }, data: { googleCalendarId: calendarId } });
    await resyncEvents(this.prisma, { userId: user.id });
    return this.status(user);
  }

  // Parents: the shared "Family" Google calendar, for family events (no one person). "" disconnects.
  @Can('users.manage')
  @Patch('family')
  async connectFamily(@CurrentUser() user: AuthUser, @Body() body?: { calendarId?: string }) {
    const calendarId = calendarIdOf(body);
    if (calendarId) {
      await checkCalendar(calendarId);
      if (await this.prisma.user.findFirst({ where: { googleCalendarId: calendarId } })) {
        throw new ConflictException("That's someone's own calendar. Make a separate \"Family\" calendar for family events.");
      }
    }
    await setFamilyCalendar(this.prisma, calendarId);
    await resyncEvents(this.prisma, { userId: null });
    return this.status(user);
  }

  // One calendar, one owner: not someone else's, and not the Family calendar.
  private async assertFree(calendarId: string, userId: number) {
    const owner = await this.prisma.user.findFirst({ where: { googleCalendarId: calendarId, NOT: { id: userId } } });
    if (owner || (await familyCalendar(this.prisma)) === calendarId) {
      throw new ConflictException('That calendar is already connected to another account.');
    }
  }
}
