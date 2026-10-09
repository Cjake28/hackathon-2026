import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { FAKE_NOTICES, FAKE_PEOPLE, FAKE_RINGING_ALARM } from '../fake';
import { PrismaService } from '../prisma.service';

// Owner: Hub dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5).
// No WebSockets: every device calls GET /api/device/poll every 3 s. It's also the heartbeat for "who's home" (#50).
@Controller()
export class DeviceController {
  constructor(private prisma: PrismaService) {}

  // → Person[]
  @Get('family')
  family() {
    return FAKE_PEOPLE;
  }

  // → Poll { cursor, notices, ringing, home }
  // Real version: notices where id > after AND (toUserId = me OR toUserId IS NULL) (no `after`: last 5 minutes),
  // my ringing alarms, people with lastSeenAt in the last 2 min (only with presence.read).
  // Updates my lastSeenAt/lastIp; back after 10+ min away → presence:arrived notice + speak("Welcome home, <name>").
  @Get('device/poll')
  poll(@CurrentUser() user: AuthUser, @Query('after') after?: string) {
    const cursor = Number(after) || 0;
    const notices = FAKE_NOTICES.filter((n) => n.id > cursor);
    return {
      cursor: Math.max(cursor, ...FAKE_NOTICES.map((n) => n.id)),
      notices,
      ringing: [FAKE_RINGING_ALARM],
      home: hasPermission(user.permissions, 'presence.read') ? FAKE_PEOPLE.filter((p) => p.isHome) : [],
    };
  }
}
