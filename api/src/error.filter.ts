import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { webIndex } from './web';

// Prisma error codes → HTTP status: record not found, unique clash, foreign key in use.
const PRISMA_STATUS: Record<string, number> = { P2025: 404, P2002: 409, P2003: 409 };

// Every error goes back as { statusCode, message } so the frontend toast shows the real reason.
// In production, unexpected (500) errors only say "Internal server error"; details stay in the server log.
// 502/503 keep their message (e.g. "The local AI is offline…"): they're written for the user.
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();
    const status =
      error instanceof HttpException ? error.getStatus() : (PRISMA_STATUS[error?.code] ?? 500);

    // Hub mode: page URLs like /items or /docs belong to the web app, so send it index.html.
    if (status === 404 && webIndex && request.method === 'GET' && !request.url.startsWith('/api')) {
      reply.status(200).type('text/html').send(webIndex);
      return;
    }

    if (status >= 500) console.error(error);
    const hide = status === 500 && process.env.NODE_ENV === 'production';
    const message = hide
      ? 'Internal server error'
      : String(error?.message ?? 'Internal server error').trim().split('\n').pop();
    reply.status(status).send({ statusCode: status, message });
  }
}
