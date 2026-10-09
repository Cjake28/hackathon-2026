import { Controller, Get } from '@nestjs/common';
import { AiService } from './ai.service';

// Chat lives in conversations/conversations.controller.ts (saved per user).
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  // { online, model, embeddingModel, missing, vision, tools } for the UI's AI status badge and features.
  @Get('status')
  status() {
    return this.ai.status();
  }
}
