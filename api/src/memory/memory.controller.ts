import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { FAKE_MEMORY } from '../fake';
import { PrismaService } from '../prisma.service';

// Owner: Brain dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #9
// "What Jarvis remembers about me". Real version: only my own notes; they also go into the Jarvis prompt.
@Controller('memory')
@Can('memory.own')
export class MemoryController {
  constructor(private prisma: PrismaService) {}

  // → MemoryNote[]
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return FAKE_MEMORY;
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { text: string }) {
    return { id: 99, userId: user.id, text: body.text, createdAt: new Date().toISOString() };
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_MEMORY[0], id };
  }
}
