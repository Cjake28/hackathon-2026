import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { AiService } from '../ai/ai.service';
import { FAKE_TASKS } from '../fake';
import { PrismaService } from '../prisma.service';

type ChorePhoto = { stage: 'before' | 'after'; image: string }; // image: base64 JPEG

// Owner: Brain dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #13 #4
// Real version (assignee only): save the photo; on "after", send before + after + checklist to the vision model
// (add images to ai.json) → { done, feedback } → status "done" or "redo", task:reviewed notice to the parent + speak.
@Controller('chores')
@Can('tasks.own')
export class ChoresController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  // → Task
  @Post(':taskId/photo')
  photo(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @Body() body: ChorePhoto) {
    const task = { ...FAKE_TASKS[0], id: taskId };
    if (body.stage === 'before') return { ...task, beforePhoto: body.image };
    return {
      ...task,
      beforePhoto: body.image,
      afterPhoto: body.image,
      status: 'redo',
      feedback: 'Almost! Two cups are still in the sink.',
    };
  }
}
