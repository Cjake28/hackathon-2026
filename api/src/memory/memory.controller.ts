import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

// Owner: Brain dev. #9 "What Jarvis remembers about me": only your own notes. They also go into the Jarvis prompt.
@Controller('memory')
@Can('memory.own')
export class MemoryController {
  constructor(private prisma: PrismaService) {}

  // → MemoryNote[]
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.memoryNote.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: { text: string }) {
    const text = body.text?.trim();
    if (!text) throw new BadRequestException('Write something to remember');
    return this.prisma.memoryNote.create({ data: { userId: user.id, text } });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    const note = await this.prisma.memoryNote.findFirst({ where: { id, userId: user.id } });
    if (!note) throw new NotFoundException('Memory not found');
    return this.prisma.memoryNote.delete({ where: { id } });
  }
}
