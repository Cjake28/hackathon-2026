import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';

// Prisma error codes → HTTP status: record not found, unique clash, foreign key in use.
const PRISMA_STATUS: Record<string, number> = { P2025: 404, P2002: 409, P2003: 409 };

// Every error goes back as { statusCode, message } so the frontend toast shows the real reason.
// In production, unexpected (500) errors only say "Internal server error"; details stay in the server log.
@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    const reply = host.switchToHttp().getResponse();
    const status =
      error instanceof HttpException ? error.getStatus() : (PRISMA_STATUS[error?.code] ?? 500);
    if (status >= 500) console.error(error);
    const hide = status >= 500 && process.env.NODE_ENV === 'production';
    const message = hide
      ? 'Internal server error'
      : String(error?.message ?? 'Internal server error').trim().split('\n').pop();
    reply.status(status).send({ statusCode: status, message });
  }
}
