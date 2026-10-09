import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { FAKE_TASKS } from '../fake';
import { PrismaService } from '../prisma.service';

type TaskInput = { title: string; assigneeId: number; isChore?: boolean; checklist?: string[]; dueAt?: string };

// Owner: Hub dev. STUB: returns fake data in the final shape (TEAM-PLAN.md 4.5). #12
// Chore photos are NOT here: POST /api/chores/:taskId/photo (Brain dev, chores.controller.ts).
@Controller('tasks')
export class TasksController {
  constructor(private prisma: PrismaService) {}

  // Mine; ?all=1 needs tasks.assign → Task[] (with assigneeName)
  @Can('tasks.own')
  @Get()
  list(@CurrentUser() user: AuthUser, @Query('all') all?: string) {
    return FAKE_TASKS;
  }

  // Real version: + notify(assigneeId, 'task:new', ...) + speak("Ana, Mom gave you a task: ...")
  @Can('tasks.assign')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: TaskInput) {
    return { ...FAKE_TASKS[0], ...body, checklist: body.checklist ?? [], createdById: user.id };
  }

  // Assignee marks a non-chore task done: { status: "done" }
  @Can('tasks.own')
  @Patch(':id')
  update(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: { status: 'done' }) {
    return { ...FAKE_TASKS[1], id, status: body.status };
  }

  @Can('tasks.assign')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return { ...FAKE_TASKS[0], id };
  }
}
