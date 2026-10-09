import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { ItemsController } from './items/items.controller';
import { PrismaService } from './prisma.service';
import { RagController } from './rag/rag.controller';
import { RagService } from './rag/rag.service';
import { RolesController } from './roles/roles.controller';
import { UsersController } from './users/users.controller';

@Module({
  imports: [
    JwtModule.register({ global: true, secret: process.env.JWT_SECRET, signOptions: { expiresIn: '7d' } }),
    // Rate limit for routes with @UseGuards(ThrottlerGuard): 10 requests per minute per IP.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 10 }],
      errorMessage: 'Too many attempts. Please wait a minute and try again.',
    }),
  ],
  // register every new controller here
  controllers: [
    AuthController,
    AiController,
    ItemsController,
    RagController,
    RolesController,
    UsersController,
  ],
  // and every new service here
  providers: [
    PrismaService,
    AiService,
    RagService,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
