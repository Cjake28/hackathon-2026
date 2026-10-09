import type { PrismaService } from '../prisma.service';

// #15 reward points: every chore the photo check approved = 10 points. Counted from done chores, so there's no
// points table to keep in sync.
export const POINTS_PER_CHORE = 10;

export async function pointsFor(prisma: PrismaService, userId: number) {
  const choresDone = await prisma.task.count({ where: { assigneeId: userId, isChore: true, status: 'done' } });
  return { choresDone, points: choresDone * POINTS_PER_CHORE };
}

// The family leaderboard, most points first. → [{ userId, name, points, choresDone }]
export async function leaderboard(prisma: PrismaService) {
  const [people, done] = await Promise.all([
    prisma.user.findMany({ where: { role: { name: { in: ['parent', 'child'] } } }, orderBy: { id: 'asc' } }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { isChore: true, status: 'done' }, _count: { _all: true } }),
  ]);
  return people
    .map((p) => {
      const choresDone = done.find((d) => d.assigneeId === p.id)?._count._all ?? 0;
      return { userId: p.id, name: p.name, points: choresDone * POINTS_PER_CHORE, choresDone };
    })
    .sort((a, b) => b.points - a.points);
}
