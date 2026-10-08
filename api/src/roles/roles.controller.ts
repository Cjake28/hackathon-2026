import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Can } from '../auth/auth.decorators';
import { PrismaService } from '../prisma.service';

type RoleInput = { name: string; permissions?: string[] };

@Controller('roles')
export class RolesController {
  constructor(private prisma: PrismaService) {}

  // Any logged-in user can read roles (the Users page needs them for the role picker).
  @Get()
  findAll() {
    return this.prisma.role.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { users: true } } },
    });
  }

  @Can('roles.manage')
  @Post()
  create(@Body() data: RoleInput) {
    return this.prisma.role.create({ data: { name: data.name, permissions: data.permissions ?? [] } });
  }

  @Can('roles.manage')
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<RoleInput>) {
    return this.prisma.role.update({ where: { id }, data });
  }

  @Can('roles.manage')
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.prisma.role.delete({ where: { id } });
  }
}
