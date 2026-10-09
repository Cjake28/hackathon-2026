import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

type EventInput = { title: string; startsAt: string; userId?: number | null };

// Owner: Hub dev (P2). #58 calendar
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

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: EventInput) {
    const startsAt = new Date(body.startsAt);
    if (!body.title?.trim() || Number.isNaN(startsAt.getTime())) throw new BadRequestException('Send { title, startsAt }');
    return this.prisma.event.create({
      data: { title: body.title.trim(), startsAt, userId: body.userId ?? null, createdById: user.id },
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.event.delete({ where: { id } });
  }
}
