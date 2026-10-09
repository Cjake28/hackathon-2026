import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Can } from '../auth/auth.decorators';
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

  // Chat models downloaded on the hub, for the AI Settings page.
  @Get('models')
  @Can('ai.manage')
  models() {
    return this.ai.listModels();
  }

  // Switch the chat model for everyone.
  @Patch('model')
  @Can('ai.manage')
  setModel(@Body() body: { model: string }) {
    return this.ai.setModel(body.model);
  }
}
