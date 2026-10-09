import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Task } from '@prisma/client';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { hasPermission } from '../auth/permissions';
import { notify, speak } from '../family';
import { PrismaService } from '../prisma.service';

type TaskInput = { title: string; assigneeId: number; isChore?: boolean; checklist?: string[]; dueAt?: string };

// Only the assignee's name, never the whole user row (it has the password hash).
const ASSIGNEE = { assignee: { select: { name: true } } } as const;
const withName = ({ assignee, ...task }: Task & { assignee: { name: string } }) => ({ ...task, assigneeName: assignee.name });

// Owner: Hub dev. #12
// Chores have no photos: the kid checks a chore off like any task (PATCH below) and the parents see it done.
@Controller('tasks')
export class TasksController {
  constructor(private prisma: PrismaService) {}

  // Mine; ?all=1 needs tasks.assign → Task[] (with assigneeName)
  @Can('tasks.own')
  @Get()
  async list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    if (all && !hasPermission(user.permissions, 'tasks.assign')) throw new ForbiddenException("Only a parent can see everyone's tasks");
    const tasks = await this.prisma.task.findMany({
      where: all ? {} : { assigneeId: user.id },
      include: ASSIGNEE,
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map(withName);
  }

  // → Task + task:new notice on the assignee's devices + the hub says it
  @Can('tasks.assign')
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: TaskInput) {
    if (!body.title?.trim()) throw new BadRequestException('Give the task a title');
    const task = await this.prisma.task.create({
      data: {
        title: body.title.trim(),
        assigneeId: body.assigneeId,
        createdById: user.id,
        isChore: !!body.isChore,
        checklist: body.checklist ?? [],
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
      include: ASSIGNEE,
    });
    await notify(this.prisma, task.assigneeId, 'task:new', `${user.name}: ${task.title}`, { taskId: task.id });
    speak(`${task.assignee.name}, ${user.name} gave you a ${task.isChore ? 'chore' : 'task'}: ${task.title}`);
    return withName(task);
  }

  // The assignee checks a task or chore off: { status: "done" } ("pending" undoes it). No photo needed: the parents
  // get a task:reviewed notice ("Ana finished: Wash the dishes") and see it done in GET /tasks?all=1.
  @Can('tasks.own')
  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body?: { status?: 'done' | 'pending' }) {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id } });
    if (task.assigneeId !== user.id && !hasPermission(user.permissions, 'tasks.assign')) {
      throw new ForbiddenException('That task is for someone else');
    }
    const done = body?.status !== 'pending';
    const saved = await this.prisma.task.update({
      where: { id },
      data: { status: done ? 'done' : 'pending', doneAt: done ? new Date() : null },
      include: ASSIGNEE,
    });
    if (done && task.status !== 'done') {
      const parents = await this.prisma.user.findMany({ where: { role: { name: 'parent' } }, select: { id: true } });
      for (const p of parents) {
        if (p.id !== user.id) {
          await notify(this.prisma, p.id, 'task:reviewed', `${saved.assignee.name} finished: ${saved.title}`, { taskId: id, status: 'done' });
        }
      }
    }
    return withName(saved);
  }

  @Can('tasks.assign')
  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return withName(await this.prisma.task.delete({ where: { id }, include: ASSIGNEE }));
  }
}
