import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { FastifyReply } from 'fastify';
import { sendStream } from '../ai/send-stream';
import { Can } from '../auth/auth.decorators';
import { RagService } from './rag.service';

@Controller('rag')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // the hub's AI is shared: 20 requests/minute per device
export class RagController {
  constructor(private rag: RagService) {}

  @Can('ai.use')
  @Get('documents')
  list() {
    return this.rag.list();
  }

  // Body: { filename: "handbook.pdf", data: "<base64 file content>" }
  @Can('docs.manage')
  @Post('documents')
  upload(@Body() body: { filename: string; data: string }) {
    return this.rag.ingest(body.filename ?? '', Buffer.from(body.data ?? '', 'base64'));
  }

  @Can('docs.manage')
  @Delete('documents/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rag.remove(id);
  }

  // Streams plain text: the first line is JSON { sources: [{ n, documentId, title, page, snippet, score }] },
  // the rest is the answer. (In other features, call RagService.ask() for { answer, sources } in one go.)
  @Can('ai.use')
  @Post('ask')
  async ask(@Body() body: { question: string }, @Res() reply: FastifyReply) {
    const { sources, answer } = await this.rag.askStream(body.question);
    return sendStream(reply, answer, `${JSON.stringify({ sources })}\n`);
  }
}
