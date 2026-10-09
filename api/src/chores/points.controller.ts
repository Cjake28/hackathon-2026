import { Controller, Get } from '@nestjs/common';
import { Can } from '../auth/auth.decorators';
import { PrismaService } from '../prisma.service';
import { leaderboard } from './points';

// Owner: Brain dev. #15: the family leaderboard for the dashboard. → [{ userId, name, points, choresDone }]
@Controller('points')
export class PointsController {
  constructor(private prisma: PrismaService) {}

  @Can('tasks.own')
  @Get()
  list() {
    return leaderboard(this.prisma);
  }
}
