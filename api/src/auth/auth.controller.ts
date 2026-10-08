import { randomInt } from 'node:crypto';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpException,
  Post,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Role, User } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import type { FastifyReply } from 'fastify';
import { OAuth2Client } from 'google-auth-library';
import { MailService } from '../mail.service';
import { PrismaService } from '../prisma.service';
import { CurrentUser, Public } from './auth.decorators';
import { toAuthUser, type AuthUser } from './auth.guard';
import { roleForNewUser } from './permissions';

const SESSION_DAYS = 7; // keep in sync with JwtModule expiresIn in app.module.ts
const CODE_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

type Reply = FastifyReply;

// Rate limited per IP: 10 requests/minute per route (see ThrottlerModule in app.module.ts),
// 5/minute for routes that send email.
const EMAIL_LIMIT = { default: { limit: 5, ttl: 60_000 } };

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  private googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private mail: MailService,
  ) {}

  @SkipThrottle()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  // Email sign-up step 1: keep the details as a pending sign-up and email a 6-digit code.
  @Public()
  @Throttle(EMAIL_LIMIT)
  @Post('register')
  async register(@Body() body: { name: string; email: string; password: string }) {
    const email = normalizeEmail(body.email);
    const name = body.name?.trim();
    if (!email || !name || (body.password?.length ?? 0) < 8) {
      throw new BadRequestException('Name, email and a password of at least 8 characters are required');
    }
    if (await this.prisma.user.findUnique({ where: { email } })) {
      throw new ConflictException('Email is already registered');
    }
    const existing = await this.prisma.pendingSignup.findUnique({ where: { email } });
    if (existing) assertCooldown(existing.sentAt);

    const { code, fields } = await newCode();
    const data = { name, password: await hash(body.password, 10), ...fields };
    await this.prisma.pendingSignup.upsert({ where: { email }, update: data, create: { email, ...data } });
    await this.sendCode(email, code);
    return { email };
  }

  // Email sign-up step 2: check the code, create the user and log them in.
  @Public()
  @Post('verify-email')
  async verifyEmail(@Body() body: { email: string; code: string }, @Res({ passthrough: true }) reply: Reply) {
    const email = normalizeEmail(body.email);
    const pending = await this.prisma.pendingSignup.findUnique({ where: { email } });
    if (!pending || pending.expiresAt < new Date() || pending.attempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException('Code expired. Request a new one.');
    }
    if (!(await compare(String(body.code ?? ''), pending.codeHash))) {
      await this.prisma.pendingSignup.update({ where: { email }, data: { attempts: { increment: 1 } } });
      throw new BadRequestException('Wrong code');
    }
    const [user] = await this.prisma.$transaction([
      this.prisma.user.create({
        data: { email, name: pending.name, password: pending.password, role: { connect: { name: roleForNewUser(email) } } },
        include: { role: true },
      }),
      this.prisma.pendingSignup.delete({ where: { email } }),
    ]);
    return this.startSession(reply, user);
  }

  @Public()
  @Throttle(EMAIL_LIMIT)
  @Post('resend-code')
  async resendCode(@Body() body: { email: string }) {
    const email = normalizeEmail(body.email);
    const pending = await this.prisma.pendingSignup.findUnique({ where: { email } });
    if (!pending) throw new BadRequestException('Sign up first');
    assertCooldown(pending.sentAt);

    const { code, fields } = await newCode();
    await this.prisma.pendingSignup.update({ where: { email }, data: fields });
    await this.sendCode(email, code);
    return { email };
  }

  @Public()
  @Post('login')
  async login(@Body() body: { email: string; password: string }, @Res({ passthrough: true }) reply: Reply) {
    const email = normalizeEmail(body.email);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { role: true } });
    if (!user && (await this.prisma.pendingSignup.findUnique({ where: { email } }))) {
      throw new ForbiddenException('Verify your email first');
    }
    if (!user?.password || !(await compare(body.password ?? '', user.password))) {
      throw new UnauthorizedException('Wrong email or password');
    }
    return this.startSession(reply, user);
  }

  // The web or mobile Google button sends the ID token ("credential"); we verify it with Google.
  @Public()
  @Post('google')
  async google(@Body() body: { credential: string }, @Res({ passthrough: true }) reply: Reply) {
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new BadRequestException('Google sign-in is not configured (GOOGLE_CLIENT_ID)');
    }
    const audience = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(
      (id): id is string => !!id,
    );
    const ticket = await this.googleClient
      .verifyIdToken({ idToken: body.credential ?? '', audience })
      .catch(() => null);
    const profile = ticket?.getPayload();
    if (!profile?.email || !profile.email_verified) throw new UnauthorizedException('Google sign-in failed');

    const email = normalizeEmail(profile.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing?.googleId && existing.googleId !== profile.sub) {
      throw new UnauthorizedException('Google sign-in failed');
    }
    // Google only vouches for Gmail and Workspace (hd) addresses, so only those may be linked
    // to an existing password account. Anyone else logs in with their password.
    const googleOwnsEmail = email.endsWith('@gmail.com') || !!profile.hd;
    if (existing && !existing.googleId && !googleOwnsEmail) {
      throw new ConflictException('This email already has an account. Log in with your password.');
    }

    const user = await this.prisma.user.upsert({
      where: { email },
      update: { googleId: profile.sub, avatarUrl: profile.picture },
      create: {
        email,
        name: profile.name ?? email,
        googleId: profile.sub,
        avatarUrl: profile.picture,
        role: { connect: { name: roleForNewUser(email) } },
      },
      include: { role: true },
    });
    await this.prisma.pendingSignup.deleteMany({ where: { email } });
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    });
    return { user: toAuthUser(user), token };
  }

  private sendCode(email: string, code: string) {
    return this.mail.send(
      email,
      `Your verification code: ${code}`,
      `Your verification code is ${code}. It expires in ${CODE_MINUTES} minutes.`,
    );
  }
}

const normalizeEmail = (email?: string) => (email ?? '').trim().toLowerCase();

const assertCooldown = (sentAt: Date) => {
  if (Date.now() - sentAt.getTime() < RESEND_SECONDS * 1000) {
    throw new HttpException(`Wait ${RESEND_SECONDS} seconds before requesting a new code`, 429);
  }
};

async function newCode() {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  return {
    code,
    fields: {
      codeHash: await hash(code, 10),
      attempts: 0,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    },
  };
}
