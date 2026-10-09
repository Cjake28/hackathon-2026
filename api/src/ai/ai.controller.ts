import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle, Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { Can } from '../auth/auth.decorators';
import { AiService, type ChatMessage } from './ai.service';
import { sendStream } from './send-stream';

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
  chat(@Body() body: { messages: ChatMessage[] }, @Res() reply: FastifyReply) {
    const messages = (body.messages ?? []).slice(-20); // keep the request small: last 20 messages
    return sendStream(reply, this.ai.chat(messages, CHAT_SYSTEM));
  }
}
