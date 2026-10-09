import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma.service';
import { BRIEFING_SYSTEM, briefingFacts } from './briefing-facts';

// Owner: Brain dev. #30: today's alarms, events, tasks, grocery list and memory → a short spoken summary.
@Controller('briefing')
export class BriefingController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  // → { text }
  @Can('ai.use')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get()
  async get(@CurrentUser() user: AuthUser) {
    const facts = await briefingFacts(this.prisma, user);
    return { text: (await this.ai.text(facts, BRIEFING_SYSTEM)).trim() };
  }
}
