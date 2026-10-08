import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { IS_PUBLIC, REQUIRED_PERMISSIONS } from './auth.decorators';
import { hasPermission, type Permission } from './permissions';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  avatarUrl: string | null;
  roleId: number;
  role: string;
  permissions: string[];
};

// The only user shape sent to the client (never includes the password hash).
export const toAuthUser = (user: User & { role: Role }): AuthUser => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatarUrl: user.avatarUrl,
  roleId: user.roleId,
  role: user.role.name,
  permissions: user.role.permissions,
});

// Global guard: checks the session (bearer token or cookie), then any @Can(...) permissions.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const request = context.switchToHttp().getRequest();
    // Mobile sends "Authorization: Bearer <token>"; web sends the httpOnly cookie.
    const bearer = request.headers.authorization?.replace(/^Bearer /i, '');
    const payload = await this.jwt
      .verifyAsync<{ sub: number }>(bearer || request.cookies?.token || '')
      .catch(() => null);
    const user =
      payload &&
      (await this.prisma.user.findUnique({ where: { id: payload.sub }, include: { role: true } }));
    if (!user) throw new UnauthorizedException('Please log in');
    request.user = toAuthUser(user);

    const required = this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS, targets);
    const missing = required?.find((p) => !hasPermission(user.role.permissions, p));
    if (missing) throw new ForbiddenException(`Missing permission: ${missing}`);
    return true;
  }
}
