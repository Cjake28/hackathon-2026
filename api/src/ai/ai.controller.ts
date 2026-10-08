import { Readable } from 'node:stream';
import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Can } from '../auth/auth.decorators';
import { AiService, type ChatMessage } from './ai.service';

const CHAT_SYSTEM = 'You are a helpful assistant inside a web and mobile app. Be concise. Reply in the language the user writes in.';

@Controller('ai')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // AI costs money: 20 requests/minute per IP
export class AiController {
  constructor(private ai: AiService) {}

  // Streams the reply as plain text. Body: { messages: [{ role: 'user' | 'assistant', content }] }
  @Can('ai.use')
  @Post('chat')
  async chat(@Body() body: { messages: ChatMessage[] }, @Res() reply: FastifyReply) {
    const messages = (body.messages ?? []).slice(-20); // keep the request small: last 20 messages
    const stream = this.ai.chat(messages, CHAT_SYSTEM);
    // Wait for the first piece so setup errors (no key, bad request) come back as normal JSON errors.
    const first = await stream.next();
    reply.header('Content-Type', 'text/plain; charset=utf-8');
    return reply.send(Readable.from(continueStream(first, stream)));
  }
}

async function* continueStream(first: IteratorResult<string>, rest: AsyncGenerator<string>) {
  if (first.done) return;
  yield first.value;
  try {
    yield* rest;
  } catch (error: any) {
    yield `\n\n[Error: ${error?.message ?? 'the AI stopped responding'}]`;
  }
}
