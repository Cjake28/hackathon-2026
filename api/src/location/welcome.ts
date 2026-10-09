import type { PrismaService } from '../prisma.service';

const VOICE_URL = process.env.VOICE_URL || 'http://127.0.0.1:4103';

// #54: someone gets home → "Welcome home, Ana" (exactly the Voice dev's pre-recorded clip) and then what's left to do:
// "You have 2 tasks left: wash the dishes and finish math homework." Used by the location page's arrival; the Hub
// dev's device poll calls it too. Fire-and-forget: does nothing if the voice service is off.
export function welcomeHome(prisma: PrismaService, user: { id: number; name: string }) {
  void (async () => {
    const tasks = await prisma.task.findMany({
      where: { assigneeId: user.id, status: { not: 'done' } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    const lines = [`Welcome home, ${user.name}`];
    if (tasks.length) {
      const titles = tasks.map((t) => t.title.toLowerCase());
      const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(', ')} and ${titles.at(-1)}`;
      lines.push(`You have ${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} left: ${list}.`);
    }
    // One at a time, so they're queued in order (two fire-and-forget requests could arrive swapped).
    for (const text of lines) {
      await fetch(`${VOICE_URL}/speak`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
    }
  })().catch(() => {});
}
