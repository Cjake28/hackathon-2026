import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Can } from '../auth/auth.decorators';
import { RagService } from './rag.service';

@Controller('rag')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 20, ttl: 60_000 } }) // AI costs money: 20 requests/minute per IP
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

  // Returns { answer, sources: [{ n, documentId, title, page, snippet, score }] }
  @Can('ai.use')
  @Post('ask')
  ask(@Body() body: { question: string }) {
    return this.rag.ask(body.question);
  }
}
