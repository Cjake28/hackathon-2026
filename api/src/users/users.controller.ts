import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { hash } from 'bcryptjs';
import { Can, CurrentUser } from '../auth/auth.decorators';
import { toAuthUser, type AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

// "email" is just the login name: "ana@family.local" or simply "ana" both work.
type UserInput = { name: string; email: string; password: string; roleId: number };

const MIN_PASSWORD = 6;
const GUEST_EMAIL = 'guest@family.local'; // every unknown voice speaks as this user (voice.controller.ts)
const login = (email?: string) => (email ?? '').trim().toLowerCase();

// No sign-up: Mom or Dad (users.manage) makes every family account here and picks its role.
@Controller('users')
@Can('users.manage')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll() {
    const users = await this.prisma.user.findMany({ include: { role: true }, orderBy: { id: 'asc' } });
    return users.map(toAuthUser);
  }

  // → the new user. A login that's taken → 409.
  @Post()
  async create(@Body() body: UserInput) {
    if (!body.name?.trim() || !login(body.email) || !body.roleId || (body.password?.length ?? 0) < MIN_PASSWORD) {
      throw new BadRequestException(`Name, login, role and a password of at least ${MIN_PASSWORD} characters are required`);
    }
    const user = await this.prisma.user.create({
      data: { name: body.name.trim(), email: login(body.email), password: await hash(body.password, 10), roleId: body.roleId },
      include: { role: true },
    });
    return toAuthUser(user);
  }

  // Change name, login, role, or set a new password. You can't change your own role (you'd lock yourself out).
  @Patch(':id')
  async update(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() body: Partial<UserInput>) {
    if (id === me.id && body.roleId !== undefined && body.roleId !== me.roleId) {
      throw new BadRequestException("You can't change your own role");
    }
    if (body.password !== undefined && body.password.length < MIN_PASSWORD) {
      throw new BadRequestException(`The password needs at least ${MIN_PASSWORD} characters`);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        name: body.name?.trim() || undefined,
        email: login(body.email) || undefined,
        roleId: body.roleId,
        password: body.password ? await hash(body.password, 10) : undefined,
      },
      include: { role: true },
    });
    return toAuthUser(user);
  }

  // Also deletes their alarms, tasks, chats and memory notes.
  @Delete(':id')
  async remove(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) {
    if (id === me.id) throw new BadRequestException("You can't delete yourself");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id } });
    if (user.email === GUEST_EMAIL) throw new BadRequestException('Keep Guest: Jarvis uses it for voices it doesn\'t know');
    return toAuthUser(await this.prisma.user.delete({ where: { id }, include: { role: true } }));
  }
}
