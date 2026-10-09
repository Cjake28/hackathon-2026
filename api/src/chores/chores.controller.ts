import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { AiService } from '../ai/ai.service';
import { notify, speak } from '../family';
import { PrismaService } from '../prisma.service';
import { POINTS_PER_CHORE, pointsFor } from './points';

type ChorePhoto = { stage: 'before' | 'after'; image: string }; // image: base64 JPEG
const MAX_IMAGE_MB = 4;

// What the vision model must return.
const Verdict = z.object({
  done: z.boolean(),
  feedback: z.string(), // one short, specific sentence for a kid
});
const SYSTEM =
  'You check house chores from photos for a family app. Be fair: small imperfections are fine. ' +
  'If something is clearly not done, say exactly what you see that is left (e.g. "two cups are still in the sink"). ' +
  'Talk to the kid in one short, friendly sentence.';

// Owner: Brain dev. #13 #4: the assignee sends a before photo, then an after photo; the AI checks the after photo
// against the chore's checklist and says done or redo with specific feedback. The parent gets a task:reviewed notice.
@Controller('chores')
@Can('tasks.own')
export class ChoresController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  // → Task (with assigneeName). "after" waits for the AI's verdict (status "done" or "redo" + feedback).
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':taskId/photo')
  async photo(@CurrentUser() user: AuthUser, @Param('taskId', ParseIntPipe) taskId: number, @Body() body: ChorePhoto) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { assignee: true } });
    if (!task) throw new NotFoundException('Task not found');
    if (task.assigneeId !== user.id && !hasPermission(user.permissions, 'tasks.assign')) {
      throw new ForbiddenException(`Only ${task.assignee.name} can send photos for this chore`);
    }
    if (!body.image) throw new BadRequestException('Take a photo first');
    if (body.image.length > MAX_IMAGE_MB * 1.37 * 1024 * 1024) throw new BadRequestException(`Max photo size is ${MAX_IMAGE_MB} MB`);
    const image = body.image.replace(/^data:image\/\w+;base64,/, ''); // accept data URLs too

    if (body.stage === 'before') {
      const saved = await this.prisma.task.update({ where: { id: taskId }, data: { beforePhoto: image, status: 'pending' } });
      return { ...saved, assigneeName: task.assignee.name };
    }

    // Only the after photo goes to the AI: comparing two photos is what small vision models do worst, and two images
    // double the wait. The before photo stays on the task for the parent's view.
    const checklist = task.checklist.length ? task.checklist.join('; ') : 'the chore is clearly finished';
    const prompt = `Chore: "${task.title}". Done means: ${checklist}.\nThis photo was taken after doing the chore. Is the chore done?`;
    const verdict = await this.ai.json(prompt, Verdict, SYSTEM, [image]);

    const saved = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        afterPhoto: image,
        status: verdict.done ? 'done' : 'redo',
        feedback: verdict.feedback,
        doneAt: verdict.done ? new Date() : null,
      },
    });
    const name = task.assignee.name;
    await notify(
      this.prisma,
      task.createdById,
      'task:reviewed',
      `${name}: ${task.title}: ${verdict.done ? 'done' : 'needs a redo'}. ${verdict.feedback}`,
      { taskId, done: verdict.done },
    );
    // #15: an approved chore is worth POINTS_PER_CHORE; `points` = the new total (for the UI's "+10"). A chore that was
    // already done earns nothing new, so don't announce points again.
    const { points } = await pointsFor(this.prisma, task.assigneeId);
    const earned = verdict.done && task.status !== 'done' ? ` That's ${POINTS_PER_CHORE} points, you have ${points} now.` : '';
    const feedback = verdict.feedback.replace(/^(great job|good job|well done|awesome|yes)[!.,]*\s*/i, ''); // the hub adds the praise
    speak(verdict.done ? `Great job, ${name}! ${feedback}${earned}` : `Almost, ${name}. ${feedback}`);
    return { ...saved, assigneeName: name, points };
  }
}
