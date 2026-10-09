import {
  BadRequestException,
  Body,
  Controller,
  Delete,
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
import type { FastifyReply } from 'fastify';
import { AiService, type ChatMessage } from '../ai/ai.service';
import { sendStream } from '../ai/send-stream';
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
const MAX_IMAGE_MB = 4;

type ConversationInput = { title?: string; useDocs?: boolean; useTools?: boolean };

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

    const answer = saveWhenDone(this.ai.chat(history, system), (text) =>
      this.prisma.conversationMessage.create({
        data: { conversationId: id, role: 'assistant', content: text, sources },
      }),
    );
    return sendStream(reply, answer, `${JSON.stringify({ sources })}\n`);
  }

  private async own(user: AuthUser, id: number) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id, userId: user.id } });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }
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
