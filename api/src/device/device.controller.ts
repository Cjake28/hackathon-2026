import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Role, User } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { notify, speak } from '../family';
import { PrismaService } from '../prisma.service';

const FAMILY_ROLES = ['parent', 'child'];
const HOME_MS = 2 * 60_000; // polled in the last 2 min = home (same rule as the who_is_home tool)
const AWAY_MS = 10 * 60_000; // first poll after 10+ min away = arrived
const FIRST_POLL_MS = 5 * 60_000; // first poll (no cursor) gets the last 5 min of notices

const toPerson = (u: User & { role: Role }) => ({
  id: u.id,
  name: u.name,
  role: u.role.name,
  isHome: !!u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < HOME_MS,
  lastSeenAt: u.lastSeenAt,
});

// Owner: Hub dev. #50 who's home + the device page's "push".
// No WebSockets: every device calls GET /api/device/poll every 3 s. It's also the heartbeat for "who's home".
// Privacy: without presence.read (guests) you get no family list, no `home`, and no family-wide notices.
@Controller()
export class DeviceController {
  constructor(private prisma: PrismaService) {}

  // → Person[] (parents and kids)
  @Get('family')
  async family(@CurrentUser() user: AuthUser) {
    if (!hasPermission(user.permissions, 'presence.read')) return [];
    const people = await this.prisma.user.findMany({
      where: { role: { name: { in: FAMILY_ROLES } } },
      include: { role: true },
      orderBy: { id: 'asc' },
    });
    return people.map(toPerson);
  }

  // → Poll { cursor, notices, ringing, home }
  @Get('device/poll')
  async poll(@CurrentUser() user: AuthUser, @Req() req: FastifyRequest, @Query('after') after?: string) {
    // Through the Cloudflare tunnel (cf-connecting-ip) the phone may be at school: only home Wi-Fi counts as home.
    if (!req.headers['cf-connecting-ip']) await this.heartbeat(user, req.ip);

    const presence = hasPermission(user.permissions, 'presence.read');
    // Read the newest id first: a notice added while we query is picked up next time, never skipped.
    const newest = await this.prisma.notice.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
    const [notices, ringing, home] = await Promise.all([
      this.prisma.notice.findMany({
        where: {
          OR: presence ? [{ toUserId: user.id }, { toUserId: null }] : [{ toUserId: user.id }],
          ...(after ? { id: { gt: Number(after) } } : { createdAt: { gte: new Date(Date.now() - FIRST_POLL_MS) } }),
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.alarm.findMany({ where: { userId: user.id, ringingAt: { not: null } } }),
      this.family(user).then((people) => people.filter((p) => p.isHome)),
    ]);
    const cursor = Math.max(Number(after) || 0, newest?.id ?? 0, ...notices.map((n) => n.id));
    return { cursor, notices, ringing, home };
  }

  // Updates lastSeenAt/lastIp. A family member back after 10+ min → presence:arrived + "Welcome home, Ana".
  private async heartbeat(user: AuthUser, ip: string) {
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { lastSeenAt: true } });
    await this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date(), lastIp: ip } });
    const away = !before.lastSeenAt || Date.now() - before.lastSeenAt.getTime() > AWAY_MS;
    if (away && FAMILY_ROLES.includes(user.role)) {
      await notify(this.prisma, null, 'presence:arrived', `${user.name} is home`, { userId: user.id });
      speak(`Welcome home, ${user.name}`);
    }
  }
}
