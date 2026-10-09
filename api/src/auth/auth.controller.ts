import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { Role, User } from '@prisma/client';
import { compare } from 'bcryptjs';
import type { FastifyReply } from 'fastify';
import { PrismaService } from '../prisma.service';
import { CurrentUser, Public } from './auth.decorators';
import { toAuthUser, type AuthUser } from './auth.guard';

const SESSION_DAYS = 7; // keep in sync with JwtModule expiresIn in app.module.ts

type Reply = FastifyReply;

// Email + password only: everything works on a local network with no internet (no email codes, no Google).
// Rate limited per IP: 10 requests/minute per route (see ThrottlerModule in app.module.ts).
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  // No sign-up: Mom or Dad (users.manage) makes every account with POST /api/users and picks its role.
  @Public()
  @Post('register')
  register() {
    throw new ForbiddenException('Ask Mom or Dad to make your account.');
  }

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) reply: Reply) {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(body.email) },
      include: { role: true },
    });
    if (!user || !(await compare(body.password ?? '', user.password))) {
      throw new UnauthorizedException('Wrong email or password');
    }
    return this.startSession(reply, user);
  }

  @Public()
  @SkipThrottle()
  @Post('logout')
  logout(@Res({ passthrough: true }) reply: Reply) {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  }

  // Web uses the httpOnly cookie. Mobile stores `token` and sends it as "Authorization: Bearer <token>".
  private startSession(reply: Reply, user: User & { role: Role }) {
    const token = this.jwt.sign({ sub: user.id });
    reply.setCookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      // Secure cookies only work over HTTPS; a local network hub usually serves plain http.
      secure: reply.request.protocol === 'https',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return { user: toAuthUser(user), token };
  }
}

const normalizeEmail = (email?: string) => (email ?? '').trim().toLowerCase();
