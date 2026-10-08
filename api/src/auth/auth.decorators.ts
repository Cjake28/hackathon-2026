import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { AuthUser } from './auth.guard';
import type { Permission } from './permissions';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_PERMISSIONS = 'requiredPermissions';

// Every route needs a logged-in user unless it is marked @Public().
export const Public = () => SetMetadata(IS_PUBLIC, true);

// @Can('items.delete'): the user's role must have every listed permission.
export const Can = (...permissions: Permission[]) => SetMetadata(REQUIRED_PERMISSIONS, permissions);

// @CurrentUser() user: AuthUser
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
