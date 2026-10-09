import { Readable } from 'node:stream';
import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Can } from '../auth/auth.decorators';
import { AiService, type ChatMessage } from './ai.service';

const CHAT_SYSTEM = 'You are a helpful assistant. Be concise. Reply in the language the user writes in.';

@Controller('ai')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // the hub's AI is shared: 20 requests/minute per device
export class AiController {
  constructor(private ai: AiService) {}

  // { online, model, embeddingModel, missing: [models not downloaded yet] } for the UI's AI status badge.
  @SkipThrottle()
  @Get('status')
  status() {
    return this.ai.status();
  }

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
