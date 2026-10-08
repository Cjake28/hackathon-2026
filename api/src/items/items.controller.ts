import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { z } from 'zod';
import { AiService } from '../ai/ai.service';
import { Can } from '../auth/auth.decorators';
import { PrismaService } from '../prisma.service';

type ItemInput = { name: string; done?: boolean };

// What the AI must return for /items/suggest.
const Suggestions = z.object({ items: z.array(z.string()).max(10) });

@Controller('items')
export class ItemsController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  @Can('items.read')
  @Get()
  findAll() {
    return this.prisma.item.findMany({ orderBy: { createdAt: 'desc' } });
  }

  @Can('items.read')
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.item.findUniqueOrThrow({ where: { id } });
  }

  @Can('items.create')
  @Post()
  create(@Body() data: ItemInput) {
    return this.prisma.item.create({ data });
  }

  // AI example: turn a goal into items (structured JSON from the AI → database).
  @Can('items.create', 'ai.use')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('suggest')
  async suggest(@Body() body: { goal: string }) {
    if (!body.goal?.trim()) throw new BadRequestException('Describe a goal first');
    const { items } = await this.ai.json(
      `Break this goal into 3 to 7 short, concrete to-do items (max 8 words each): ${body.goal}`,
      Suggestions,
      'You write short, actionable to-do items. Use the language of the goal.',
    );
    return this.prisma.item.createManyAndReturn({ data: items.map((name) => ({ name })) });
  }

  @Can('items.update')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<ItemInput>) {
    return this.prisma.item.update({ where: { id }, data });
  }

  @Can('items.delete')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.item.delete({ where: { id } });
  }
}
