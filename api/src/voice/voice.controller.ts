import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpException,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Prisma } from '@prisma/client';
import type { FastifyRequest } from 'fastify';
import { AiService, type AiMessage, type ChatMessage } from '../ai/ai.service';
import { checkTool, runTool, toolSpecs, toolsFor } from '../ai/tools';
import { Can, CurrentUser, Public } from '../auth/auth.decorators';
import { toAuthUser, type AuthUser } from '../auth/auth.guard';
import { BRIEFING_SYSTEM, briefingFacts, say } from '../briefing/briefing-facts';
import { notify } from '../family';
import { PrismaService } from '../prisma.service';
import { RagService } from '../rag/rag.service';

type VoiceCommand = { speakerId: number | null; confidence: number; text: string };
type PendingAction = { tool: string; args: unknown; description: string; status: 'pending' | 'done' | 'cancelled' };
type Answer = { text: string; action?: PendingAction };

const GUEST_EMAIL = 'guest@family.local'; // every unknown voice speaks as this user (seed.ts)
const YES = /^(yes|yeah|yep|yup|oo|opo|oho|sige|go|okay|ok|confirm|sure|do it|tama)\b/i;
const NO = /^(no|nope|hindi|huwag|wag|cancel|stop|never mind|ayaw)\b/i;
const CONFIRM_SECONDS = 60; // a proposed action waits this long for "yes"
// A guest asking about the family always gets this exact sentence: never leaks anything, and matches the Voice dev's
// pre-recorded clip (voice/clips/phrases.txt), so it plays instantly. General questions still go to the AI.
const GUEST_REFUSAL = "I don't recognize your voice, so I can't share family info.";
const FAMILY_TOPIC =
  /\bhome\b|bahay|alarm|task|chore|grocer|calendar|schedule|budget|spend|money|family|pamilya|\bmom\b|\bdad\b|nanay|tatay|\bkids?\b|anak/i;
const LOCALHOST = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
const RECENT_MINUTES = 5; // earlier voice messages the AI sees, for follow-ups
// "Good morning, Jarvis" always gives the briefing (#30): too important for the demo to leave to the model.
const BRIEFING = /^(good morning|morning|magandang umaga)\b|what('s| is) (my|the) (day|schedule)|ano.*(gagawin|schedule) ko/i;
// "Where is Ana?" / "Nasaan na si Ana?" always reads the real location (#51): the small model repeats old answers.
const WHERE = /^(?:hey jarvis,?\s*)?(?:where is|where's|nasaan(?: na)?(?: si)?)\s+([\p{L}' ]+?)\s*(?:now|ngayon)?\??$/iu;

// Owner: Brain dev. Jarvis: the voice service (or the web's typed box) sends what someone said, the AI answers with
// the family tools (api/src/ai/tools.ts) and the reply is spoken. Permissions come from the speaker's role, never
// from the prompt. Each person's exchanges are saved in their "Voice" chat, so the web chat page shows them too.
@Controller('voice')
export class VoiceController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private rag: RagService,
  ) {}

  // From the Python voice service on the hub. speakerId null = unknown voice → the Guest user. → VoiceReply
  @Public()
  @Post('command')
  async command(@Req() req: FastifyRequest, @Headers('x-hub-key') key: string | undefined, @Body() body: VoiceCommand) {
    this.onlyTheHub(req, key);
    const where = body.speakerId ? { id: body.speakerId } : { email: GUEST_EMAIL };
    const user = await this.prisma.user.findUnique({ where, include: { role: true } });
    if (!user) throw new NotFoundException(body.speakerId ? `No user with id ${body.speakerId}` : 'Run npm run db:seed (no Guest user)');
    return this.handle(toAuthUser(user), body.text, body.confidence ?? 1);
  }

  // Typed Jarvis from the web ("Type to Jarvis" box, the on-stage fallback). Speaker = the logged-in user.
  @Can('ai.use')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // the hub's AI is shared: 20 turns/minute per device
  @Post('text')
  text(@CurrentUser() user: AuthUser, @Body() body: { text: string }) {
    return this.handle(user, body.text, 1);
  }

  // For voice enrollment: who can be enrolled, with real ids. → { id, name, role }[]
  @Public()
  @Get('people')
  async people(@Req() req: FastifyRequest, @Headers('x-hub-key') key: string | undefined) {
    this.onlyTheHub(req, key);
    const users = await this.prisma.user.findMany({ orderBy: { id: 'asc' }, include: { role: true } });
    return users.map((u) => ({ id: u.id, name: u.name, role: u.role.name }));
  }

  // The voice service runs on the hub, so it calls from 127.0.0.1. The Cloudflare tunnel's cloudflared also runs on the
  // hub, so internet requests arrive from 127.0.0.1 too, but with a cf-connecting-ip header: refuse those. Without
  // this, the hub key alone would let anyone on the internet speak as Mom.
  private onlyTheHub(req: FastifyRequest, key: string | undefined) {
    if (!LOCALHOST.includes(req.ip) || req.headers['cf-connecting-ip']) {
      throw new ForbiddenException('Only the voice service on the hub can call this');
    }
    if (!process.env.HUB_KEY) throw new UnauthorizedException('Set HUB_KEY in api/.env (npm run setup adds it)');
    if (key !== process.env.HUB_KEY) throw new UnauthorizedException('Wrong x-hub-key');
  }

  private async handle(user: AuthUser, raw: string, confidence: number) {
    const text = raw?.trim();
    if (!text) throw new BadRequestException('Say something first');
    const conversation =
      (await this.prisma.conversation.findFirst({ where: { userId: user.id, title: 'Voice' } })) ??
      (await this.prisma.conversation.create({ data: { userId: user.id, title: 'Voice', useTools: true } }));

    const answer = (await this.confirmByVoice(user, conversation.id, text)) ?? (await this.think(user, conversation.id, text));

    await this.prisma.conversationMessage.create({ data: { conversationId: conversation.id, role: 'user', content: text } });
    await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: answer.text,
        action: answer.action as Prisma.InputJsonValue | undefined,
      },
    });
    await this.prisma.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    await notify(this.prisma, null, 'voice:heard', `${user.name}: ${text}`, { speaker: user.name, confidence, reply: answer.text });

    return { reply: answer.text, speaker: { id: user.id, name: user.name, role: user.role }, pending: !!answer.action };
  }

  // "Yes" / "oo" / "sige" runs the action Jarvis just proposed; "no" / "hindi" cancels it. Anything else (or after
  // CONFIRM_SECONDS) drops the proposal and is handled as a new request. Returns null when there's nothing to confirm.
  private async confirmByVoice(user: AuthUser, conversationId: number, text: string): Promise<Answer | null> {
    const last = await this.prisma.conversationMessage.findFirst({
      where: { conversationId, role: 'assistant' },
      orderBy: { id: 'desc' },
    });
    const action = last?.action as PendingAction | null | undefined;
    if (!last || action?.status !== 'pending') return null;

    const word = text.toLowerCase().replace(/[^\p{L}\s]/gu, '').trim();
    const fresh = Date.now() - last.createdAt.getTime() < CONFIRM_SECONDS * 1000;
    const approve = fresh && YES.test(word);
    let status: PendingAction['status'] = 'cancelled';
    let answer: Answer | null = fresh && NO.test(word) ? { text: 'Okay, cancelled.' } : null;

    if (approve) {
      const tool = toolsFor(user).find((t) => t.name === action.tool);
      try {
        if (!tool) throw new ForbiddenException("you're not allowed to do that.");
        await runTool(tool, action.args, { prisma: this.prisma, rag: this.rag, user });
        status = 'done';
        answer = { text: `Done! ${action.description}.` };
      } catch (error) {
        answer = { text: this.sorry(user, error) };
      }
    }
    await this.prisma.conversationMessage.update({
      where: { id: last.id },
      data: { action: { ...action, status } as Prisma.InputJsonValue },
    });
    return answer;
  }

  // The AI answers, using tools (up to 5 steps). A tool that changes data stops the loop and comes back as a
  // pending action ("... Say yes to confirm."). Refusals (403/404/400 from a tool) are spoken, not thrown.
  private async think(user: AuthUser, conversationId: number, text: string): Promise<Answer> {
    const guest = user.role === 'guest';
    if (guest && (FAMILY_TOPIC.test(text) || (await this.mentionsFamily(text)))) return { text: GUEST_REFUSAL };
    if (!guest && BRIEFING.test(text)) {
      return { text: spoken(await this.ai.text(await briefingFacts(this.prisma, user), BRIEFING_SYSTEM)) };
    }
    const tools = guest ? [] : toolsFor(user).filter((t) => t.name !== 'search_documents');
    const deps = { prisma: this.prisma, rag: this.rag, user };

    // Earlier messages only when Jarvis just asked something ("Which alarm?"): otherwise the small model copies old
    // answers ("Ana is at school") instead of calling the tool again.
    const recent = await this.prisma.conversationMessage.findMany({
      where: { conversationId, createdAt: { gte: new Date(Date.now() - RECENT_MINUTES * 60_000) } },
      orderBy: { id: 'desc' },
      take: 8,
    });
    const followUp = recent[0]?.role === 'assistant' && recent[0].content.trim().endsWith('?') && !recent[0].action;
    const history: ChatMessage[] = [
      ...(followUp ? recent.reverse().map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })) : []),
      { role: 'user', content: text },
    ];
    const messages: AiMessage[] = [{ role: 'system', content: await this.system(user) }, ...history];

    try {
      const where = guest ? null : text.match(WHERE);
      if (where) {
        const tool = tools.find((t) => t.name === 'where_is');
        if (!tool) return { text: `Sorry ${user.name}. Only parents can check where people are.` };
        return { text: String(await runTool(tool, { person: where[1].trim() }, deps)) };
      }

      for (let step = 0; step < 5; step++) {
        const reply = await this.ai.toolStep(messages, toolSpecs(tools));
        const calls = reply.tool_calls ?? [];
        if (!calls.length) return { text: spoken(reply.content) || 'Okay.' };
        messages.push(reply);

        for (const call of calls) {
          const tool = tools.find((t) => t.name === call.function.name);
          const args = tool?.params.safeParse(call.function.arguments);
          if (!tool || !args?.success) {
            messages.push({ role: 'tool', tool_name: call.function.name, content: 'Error: unknown tool or invalid arguments.' });
            continue;
          }
          if (tool.confirm) {
            await checkTool(tool, args.data, deps);
            const description = (tool.describe as ((a: unknown) => string) | undefined)?.(args.data) ?? tool.name;
            return {
              text: `${description}? Say yes to confirm.`,
              action: { tool: tool.name, args: args.data, description, status: 'pending' },
            };
          }
          const result = await runTool(tool, args.data, deps);
          const content = typeof result === 'string' ? result : JSON.stringify(result);
          messages.push({ role: 'tool', tool_name: tool.name, content: content.slice(0, 6000) });
        }
      }
      return { text: 'Sorry, that took too many steps. Try asking for one thing at a time.' };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() < 500) return { text: this.sorry(user, error) };
      throw error; // AI offline etc.: the voice service gets the 503 and says so
    }
  }

  private async system(user: AuthUser) {
    const now = new Date();
    const time = `It is now ${say(now)}, ${now.getFullYear()} (date ${now.toLocaleDateString('en-CA')}).`;
    const style =
      'Your answer is spoken aloud: 1 or 2 short sentences, plain text, no lists, no markdown, no emojis. ' +
      'Reply in the language the speaker uses (English, Tagalog or Taglish).';

    if (user.role === 'guest') {
      return [
        "You are Jarvis, the voice assistant of a family's home hub. You don't recognize this speaker's voice, so they are a guest.",
        'Never share or change family information (people, alarms, tasks, schedules, who is home, shopping, money).',
        "If they ask for it, say you don't recognize their voice so you can't help with that.",
        'You can answer general questions: just answer them, without mentioning family information or their voice.',
        style,
        time,
      ].join('\n');
    }

    const [family, memory] = await Promise.all([
      this.prisma.user.findMany({ where: { role: { name: { in: ['parent', 'child'] } } }, include: { role: true }, orderBy: { id: 'asc' } }),
      this.prisma.memoryNote.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 15 }),
    ]);
    return [
      "You are Jarvis, the friendly voice assistant of this family's home hub.",
      `You are talking to ${user.name} (${user.role}). Family: ${family.map((u) => `${u.name} (${u.role.name})`).join(', ')}.`,
      time,
      memory.length ? `What you remember about ${user.name}: ${memory.map((m) => m.text).join('; ')}.` : '',
      style,
      `Use a tool only when ${user.name} asks for something a tool does. "Me", "my" and "I" mean ${user.name}.`,
      'For anything that changes (where people are, who is home, alarms, tasks, lists), call the tool again every time: ' +
        'earlier answers may be out of date. Never guess or invent facts about the family: say only what tools return, ' +
        "and if you have no tool for it, say you can't check that.",
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async mentionsFamily(text: string) {
    const family = await this.prisma.user.findMany({ where: { role: { name: { in: ['parent', 'child'] } } } });
    // Speech-to-text spellings too: "Anna" → Ana (doubled letters squashed on both sides). "been" isn't Ben.
    const squash = (s: string) => s.toLowerCase().replace(/(.)\1+/g, '$1');
    const words = text.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w && w !== 'been');
    return family.some((u) => words.some((w) => squash(w) === squash(u.name)));
  }

  private sorry(user: AuthUser, error: unknown) {
    if (!(error instanceof HttpException)) throw error;
    return error.getStatus() === 400 ? error.message : `Sorry ${user.name}. ${error.message}`;
  }
}

// Small models still sneak in Markdown; the reply is spoken, so strip it.
const spoken = (text: string) =>
  text
    .replace(/[*_#`>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
