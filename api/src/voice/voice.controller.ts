import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { CurrentUser, Public } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

type VoiceCommand = { speakerId: number | null; confidence: number; text: string };

// Owner: Brain dev. STUB replies (TEAM-PLAN.md 4.5). The hub-key check and the speaker lookup are already real.
// Real version: Jarvis prompt (time, speaker, memory, who's home), tool loop copied from conversations.controller.ts,
// saved in the speaker's "Voice" conversation, voice confirm (yes/oo/sige), and a voice:heard notice.
@Controller('voice')
export class VoiceController {
  constructor(private prisma: PrismaService) {}

  // From the Python voice service. speakerId null = unknown voice → the Guest user. → VoiceReply
  @Public()
  @Post('command')
  async command(@Headers('x-hub-key') key: string | undefined, @Body() body: VoiceCommand) {
    this.checkKey(key);
    const user = body.speakerId
      ? await this.prisma.user.findUniqueOrThrow({ where: { id: body.speakerId }, include: { role: true } })
      : await this.prisma.user.findUniqueOrThrow({ where: { email: 'guest@family.local' }, include: { role: true } });
    return this.stubReply({ id: user.id, name: user.name, role: user.role.name }, body.text);
  }

  // Typed Jarvis from the web ("Type to Jarvis" box, the on-stage fallback). Speaker = the logged-in user.
  @Post('text')
  text(@CurrentUser() user: AuthUser, @Body() body: { text: string }) {
    return this.stubReply({ id: user.id, name: user.name, role: user.role }, body.text);
  }

  // For voice enrollment: who can be enrolled, with real ids. → { id, name, role }[]
  @Public()
  @Get('people')
  async people(@Headers('x-hub-key') key: string | undefined) {
    this.checkKey(key);
    const users = await this.prisma.user.findMany({ orderBy: { id: 'asc' }, include: { role: true } });
    return users.map((u) => ({ id: u.id, name: u.name, role: u.role.name }));
  }

  private checkKey(key: string | undefined) {
    if (!process.env.HUB_KEY) throw new UnauthorizedException('Set HUB_KEY in api/.env (npm run setup adds it)');
    if (key !== process.env.HUB_KEY) throw new UnauthorizedException('Wrong x-hub-key');
  }

  private stubReply(speaker: { id: number; name: string; role: string }, text: string) {
    return { reply: `(stub) ${speaker.name}, I heard: ${text}`, speaker, pending: false };
  }
}
