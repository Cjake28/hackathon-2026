import { Controller, Get } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { AiService } from '../ai/ai.service';
import { FAKE_BRIEFING } from '../fake';
import { PrismaService } from '../prisma.service';

// Owner: Brain dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #30
// Real version: today's alarms, events, pending tasks, grocery count, memory notes → ai.text → short spoken summary.
@Controller('briefing')
export class BriefingController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  // → { text }
  @Can('ai.use')
  @Get()
  get(@CurrentUser() user: AuthUser) {
    return { text: FAKE_BRIEFING };
  }
}
