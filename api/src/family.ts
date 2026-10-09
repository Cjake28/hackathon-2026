import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AuthUser } from './auth/auth.guard';
import { hasPermission, type Permission } from './auth/permissions';
import type { PrismaService } from './prisma.service';

// Shared helpers every family-hub feature uses (TEAM-PLAN.md 4.3). Owner: Hub dev.
// Don't change a signature without telling the team.

const VOICE_URL = process.env.VOICE_URL || 'http://127.0.0.1:4103';

export type NoticeKind =
  | 'alarm:ring'
  | 'task:new'
  | 'task:reviewed'
  | 'presence:arrived'
  | 'presence:left'
  | 'voice:heard'
  | 'intercom';

// The hub says something out loud. Fire-and-forget: does nothing if the voice service is off.
export function speak(text: string) {
  void fetch(`${VOICE_URL}/speak`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}

// Shows something on devices (picked up by GET /api/device/poll). toUserId null = every device.
export function notify(prisma: PrismaService, toUserId: number | null, kind: NoticeKind, text: string, data?: object) {
  return prisma.notice.create({ data: { toUserId, kind, text, data: data as Prisma.InputJsonValue } });
}

// "Ana" / "ana" / "me" / "ako" → the user. Voice and AI use names, not ids.
export async function findPerson(prisma: PrismaService, name: string | undefined, me: AuthUser) {
  if (!name || /^(me|myself|ako)$/i.test(name.trim())) return prisma.user.findUniqueOrThrow({ where: { id: me.id } });
  const user = await prisma.user.findFirst({ where: { name: { equals: name.trim(), mode: 'insensitive' } } });
  if (!user) throw new NotFoundException(`I don't know anyone called ${name}`);
  return user;
}

// Doing something for someone else (Ana's alarm, Ana's task) needs the family permission.
export function assertCanActFor(me: AuthUser, targetUserId: number, familyPermission: Permission) {
  if (targetUserId !== me.id && !hasPermission(me.permissions, familyPermission)) {
    throw new ForbiddenException('Only a parent can do that for someone else');
  }
}

// Next time an alarm rings. time = "HH:mm" (hub local time).
export function nextAt(time: string, repeat: string, from = new Date()) {
  const [h, m] = time.split(':').map(Number);
  const next = new Date(from);
  next.setHours(h, m, 0, 0);
  if (next <= from) next.setDate(next.getDate() + 1);
  if (repeat === 'weekdays') while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
  return next;
}
