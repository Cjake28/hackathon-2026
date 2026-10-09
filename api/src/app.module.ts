import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiController } from './ai/ai.controller';
import { AiService } from './ai/ai.service';
import { AlarmsController } from './alarms/alarms.controller';
import { AuthController } from './auth/auth.controller';
import { AuthGuard } from './auth/auth.guard';
import { BriefingController } from './briefing/briefing.controller';
import { ExpensesController } from './budget/expenses.controller';
import { EventsController } from './calendar/events.controller';
import { ChoresController } from './chores/chores.controller';
import { ConversationsController } from './conversations/conversations.controller';
import { DeviceController } from './device/device.controller';
import { HubController } from './hub.controller';
import { ItemsController } from './items/items.controller';
import { LocationController } from './location/location.controller';
import { MemoryController } from './memory/memory.controller';
import { PrismaService } from './prisma.service';
import { RagController } from './rag/rag.controller';
import { RagService } from './rag/rag.service';
import { RolesController } from './roles/roles.controller';
import { SchedulerService } from './scheduler.service';
import { TasksController } from './tasks/tasks.controller';
import { UsersController } from './users/users.controller';
import { VoiceController } from './voice/voice.controller';

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
    ConversationsController,
    AiController,
    HubController,
    ItemsController,
    RagController,
    RolesController,
    UsersController,
    // Family hub (TEAM-PLAN.md). Hub dev:
    AlarmsController,
    DeviceController,
    EventsController,
    ExpensesController,
    TasksController,
    // Brain dev:
    BriefingController,
    ChoresController,
    LocationController,
    MemoryController,
    VoiceController,
  ],
  // and every new service here
  providers: [
    PrismaService,
    AiService,
    RagService,
    SchedulerService, // Hub: rings alarms every 10 s
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
