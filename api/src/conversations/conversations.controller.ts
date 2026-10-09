import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Prisma } from '@prisma/client';
import type { FastifyReply } from 'fastify';
import { AiService, type AiMessage, type ChatMessage } from '../ai/ai.service';
import { sendStream } from '../ai/send-stream';
import { runTool, toolSpecs, toolsFor } from '../ai/tools';
import { Can, CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';
import { RagService, type Source } from '../rag/rag.service';

const SYSTEM =
  'You are a helpful study buddy and assistant. Be concise and clear. Reply in the language the user writes in.';
const WITH_DOCS = [
  "Numbered sources from the user's documents are below.",
  'If they answer the question, use them, copy facts exactly and cite them like [1].',
  "If they don't cover it, say the documents don't cover it before answering from general knowledge.",
  "Never paste the sources' text into your answer.",
].join(' ');
const WITH_TOOLS =
  'You can use tools to look things up or change data in this app. Use a tool only when the user asks for something it does. After using tools, answer in one or two sentences.';
const MAX_IMAGE_MB = 4;

type ConversationInput = { title?: string; useDocs?: boolean; useTools?: boolean };
type PendingAction = { tool: string; args: unknown; description: string; status: 'pending' | 'done' | 'cancelled' };

// Saved AI chats, one list per user. Sending a message streams the reply:
// first line JSON { sources }, then the answer text (read by useSendMessage in hooks/useConversations.ts).
@Controller('conversations')
@Can('ai.use')
export class ConversationsController {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private rag: RagService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, useDocs: true, useTools: true, updatedAt: true },
    });
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() body: ConversationInput) {
    return this.prisma.conversation.create({
      data: { userId: user.id, useDocs: !!body.useDocs, useTools: !!body.useTools },
    });
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.own(user, id);
    return this.prisma.conversation.findUniqueOrThrow({
      where: { id },
      include: { messages: { orderBy: { id: 'asc' } } },
    });
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ConversationInput,
  ) {
    await this.own(user, id);
    return this.prisma.conversation.update({
      where: { id },
      data: { title: body.title, useDocs: body.useDocs, useTools: body.useTools },
    });
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number) {
    await this.own(user, id);
    return this.prisma.conversation.delete({ where: { id } });
  }

  // Body: { content, image?: base64 JPEG }. Saves the question, streams the answer, saves the answer.
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } }) // the hub's AI is shared: 20 messages/minute per device
  @Post(':id/messages')
  async send(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { content: string; image?: string },
    @Res() reply: FastifyReply,
  ) {
    const conversation = await this.own(user, id);
    const content = body.content?.trim();
    if (!content) throw new BadRequestException('Write a message first');
    if (body.image && body.image.length > MAX_IMAGE_MB * 1.37 * 1024 * 1024) {
      throw new BadRequestException(`Max image size is ${MAX_IMAGE_MB} MB`);
    }

    const earlier = await this.prisma.conversationMessage.findMany({
      where: { conversationId: id },
      orderBy: { id: 'desc' },
      take: 19, // the model sees the last 20 messages
    });
    await this.prisma.conversationMessage.create({
      data: { conversationId: id, role: 'user', content, image: body.image },
    });
    await this.prisma.conversation.update({
      where: { id },
      data: conversation.title === 'New chat' ? { title: content.slice(0, 60) } : { updatedAt: new Date() },
    });

    // Only the newest picture goes to the model: pictures are slow for small local models.
    const history: ChatMessage[] = [
      ...earlier.reverse().map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
      { role: 'user', content, images: body.image ? [body.image] : undefined },
    ];

    let system = SYSTEM;
    let sources: Source[] = [];
    if (conversation.useDocs) {
      const found = await this.rag.search(content);
      sources = found.sources;
      if (found.context) system += `\n\n${WITH_DOCS}\n\n${found.context}`;
    }

    // "Allow app actions": the AI may use tools (api/src/ai/tools.ts). Not streamed: tool steps run first.
    if (conversation.useTools) {
      const { text, action } = await this.agentReply(history, `${system}\n\n${WITH_TOOLS}`, user);
      await this.prisma.conversationMessage.create({
        data: { conversationId: id, role: 'assistant', content: text, sources, action: action as Prisma.InputJsonValue },
      });
      return sendStream(reply, once(text), `${JSON.stringify({ sources, action })}\n`);
    }

    const answer = saveWhenDone(this.ai.chat(history, system), (text) =>
      this.prisma.conversationMessage.create({
        data: { conversationId: id, role: 'assistant', content: text, sources },
      }),
    );
    return sendStream(reply, answer, `${JSON.stringify({ sources })}\n`);
  }

  // Confirm or cancel a tool action the AI proposed. Body: { approve: boolean }. Returns the new note message.
  @Post(':id/messages/:messageId/action')
  async resolveAction(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('messageId', ParseIntPipe) messageId: number,
    @Body() body: { approve: boolean },
  ) {
    await this.own(user, id);
    const message = await this.prisma.conversationMessage.findFirst({ where: { id: messageId, conversationId: id } });
    const action = message?.action as PendingAction | null | undefined;
    if (!action || action.status !== 'pending') throw new BadRequestException('There is nothing to confirm');

    let status: PendingAction['status'] = 'cancelled';
    let note = `Cancelled: ${action.description}.`;
    if (body.approve) {
      // Permissions are checked again now, not when the AI proposed it.
      const tool = toolsFor(user).find((t) => t.name === action.tool);
      if (!tool) throw new ForbiddenException('You are not allowed to do that');
      await runTool(tool, action.args, { prisma: this.prisma, rag: this.rag, user });
      status = 'done';
      note = `Done: ${action.description}.`;
    }
    await this.prisma.conversationMessage.update({
      where: { id: messageId },
      data: { action: { ...action, status } as Prisma.InputJsonValue },
    });
    return this.prisma.conversationMessage.create({ data: { conversationId: id, role: 'assistant', content: note } });
  }

  // Tool loop: the AI calls read-only tools as needed (up to 5 steps). A tool that changes data stops the loop
  // and comes back as a pending action for the user to confirm.
  private async agentReply(history: ChatMessage[], system: string, user: AuthUser) {
    const tools = toolsFor(user);
    const messages: AiMessage[] = [{ role: 'system', content: system }, ...history];
    for (let step = 0; step < 5; step++) {
      const reply = await this.ai.toolStep(messages, toolSpecs(tools));
      const calls = reply.tool_calls ?? [];
      if (!calls.length) return { text: reply.content.trim() || 'Done.' };
      messages.push(reply);

      for (const call of calls) {
        const tool = tools.find((t) => t.name === call.function.name);
        const args = tool?.params.safeParse(call.function.arguments);
        if (!tool || !args?.success) {
          messages.push({ role: 'tool', tool_name: call.function.name, content: 'Error: unknown tool or invalid arguments.' });
          continue;
        }
        if (tool.confirm) {
          const description = (tool.describe as ((a: unknown) => string) | undefined)?.(args.data) ?? tool.name;
          const action: PendingAction = { tool: tool.name, args: args.data, description, status: 'pending' };
          return { text: `I'd like to: ${description}. Tap Confirm to go ahead.`, action };
        }
        const result = await runTool(tool, args.data, { prisma: this.prisma, rag: this.rag, user });
        const content = typeof result === 'string' ? result : JSON.stringify(result);
        messages.push({ role: 'tool', tool_name: tool.name, content: content.slice(0, 6000) });
      }
    }
    return { text: 'I stopped after 5 steps. Try asking for one thing at a time.' };
  }

  private async own(user: AuthUser, id: number) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, userId: user.id } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
}

async function* once(text: string) {
  yield text;
}

// Passes the answer through and saves it when it ends (also when the user leaves mid-answer).
async function* saveWhenDone(stream: AsyncGenerator<string>, save: (text: string) => Promise<unknown>) {
  let text = '';
  try {
    for await (const piece of stream) {
      text += piece;
      yield piece;
    }
  } finally {
    if (text.trim()) await save(text);
  }
}
