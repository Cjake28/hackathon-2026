import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { FAKE_EVENTS } from '../fake';
import { PrismaService } from '../prisma.service';

type EventInput = { title: string; startsAt: string; userId?: number | null };

// Owner: Hub dev (P2). STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #58 calendar
@Controller('events')
@Can('calendar.use')
export class EventsController {
  constructor(private prisma: PrismaService) {}

  // → FamilyEvent[] (upcoming first)
  @Get()
  list() {
    return FAKE_EVENTS;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: EventInput) {
    return { id: 99, title: body.title, startsAt: body.startsAt, userId: body.userId ?? null, createdById: user.id };
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_EVENTS[0], id };
  }
}
