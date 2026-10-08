import { Body, Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { Can } from '../auth/auth.decorators';
import { toAuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

@Controller('users')
@Can('users.manage')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const users = await this.prisma.user.findMany({ include: { role: true }, orderBy: { id: 'asc' } });
    return users.map(toAuthUser);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() data: { roleId: number }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: { roleId: data.roleId },
      include: { role: true },
    });
    return toAuthUser(user);
  }
}
