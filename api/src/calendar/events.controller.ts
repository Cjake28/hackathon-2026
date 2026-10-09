import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { eventICanChange } from '../ai/tools';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

type EventInput = { title: string; startsAt: string; userId?: number | null };

// Owner: Hub dev. #58 calendar. Jarvis adds, moves and cancels events by voice (tools.ts); the scheduler gives a
// heads-up 15 min before each one (scheduler.service.ts).
@Controller('events')
@Can('calendar.use')
export class EventsController {
  constructor(private prisma: PrismaService) {}

  // → FamilyEvent[] from today on, soonest first
  @Get()
  list() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.prisma.event.findMany({ where: { startsAt: { gte: today } }, orderBy: { startsAt: 'asc' } });
  }

  // userId: whose event (null or left out = the whole family)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: EventInput) {
    const startsAt = new Date(body.startsAt);
    if (!body.title?.trim() || Number.isNaN(startsAt.getTime())) throw new BadRequestException('Send { title, startsAt }');
    return this.prisma.event.create({
      data: { title: body.title.trim(), startsAt, userId: body.userId ?? null, createdById: user.id },
    });
  }

  // Move, rename or change whose it is. Whoever added it, or a parent (same rule as Jarvis's move_event).
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: Partial<EventInput>) {
    await eventICanChange(this.prisma, user, id);
    const startsAt = body.startsAt === undefined ? undefined : new Date(body.startsAt);
    if (startsAt && Number.isNaN(startsAt.getTime())) throw new BadRequestException('Send startsAt as a date and time');
    if (body.title !== undefined && !body.title.trim()) throw new BadRequestException('The event needs a title');
    return this.prisma.event.update({
      where: { id },
      data: { title: body.title?.trim(), startsAt, userId: body.userId },
    });
  }

  // Whoever added it, or a parent (same rule as Jarvis's cancel_event).
  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await eventICanChange(this.prisma, user, id);
    return this.prisma.event.delete({ where: { id } });
  }
}
