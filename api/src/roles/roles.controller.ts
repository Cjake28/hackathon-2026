import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PERMISSIONS } from '../auth/permissions';
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

  // Every permission there is, for the role editor's checkboxes (so the apps don't keep their own copy).
  @Get('permissions')
  permissions() {
    return PERMISSIONS;
  }

  @Can('roles.manage')
  @Post()
  create(@Body() data: RoleInput) {
    return this.prisma.role.create({ data: { name: data.name, permissions: data.permissions ?? [] } });
  }

  // You can't change or delete your own role: you could lock yourself out of this page.
  @Can('roles.manage')
  @Patch(':id')
  update(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() data: Partial<RoleInput>) {
    if (id === me.roleId) throw new BadRequestException("You can't change your own role");
    return this.prisma.role.update({ where: { id }, data: { name: data.name, permissions: data.permissions } });
  }

  @Can('roles.manage')
  @Delete(':id')
  remove(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    if (id === me.roleId) throw new BadRequestException("You can't delete your own role");
    return this.prisma.role.delete({ where: { id } });
  }
}
