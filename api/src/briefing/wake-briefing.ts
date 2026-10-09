import { toAuthUser } from '../auth/auth.guard';
import type { AiService } from '../ai/ai.service';
import { speak } from '../family';
import type { PrismaService } from '../prisma.service';
import { BRIEFING_SYSTEM, briefingFacts } from './briefing-facts';

// "Wake up" alarms (and "gising"), not reminders like "Take medicine".
export const isWakeUp = (alarm: { kind: string; label: string }) =>
  alarm.kind === 'alarm' && /wake|gising|bangon/i.test(alarm.label);

// Owner: Brain dev. Ana dismisses her wake-up alarm → the hub says her good-morning briefing right away (#30 + #25).
// Called from Hub's POST /alarms/:id/dismiss. Fire-and-forget: if the AI is slow or down, it just says nothing.
export function briefOnWakeUp(prisma: PrismaService, ai: AiService, userId: number) {
  void (async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
    const text = await ai.text(await briefingFacts(prisma, toAuthUser(user)), BRIEFING_SYSTEM);
    speak(text.replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim()); // spoken: no Markdown
  })().catch((error) => console.error('[briefing] wake-up briefing failed:', error?.message ?? error));
}
