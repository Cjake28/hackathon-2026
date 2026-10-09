import { Readable } from 'node:stream';
import type { FastifyReply } from 'fastify';

// Sends a streamed AI answer as plain text, optionally after a first `header` line (e.g. RAG sources).
// - With a header: it goes out right away, so the UI can show it while the AI is still thinking.
// - Without: waits for the first piece so setup errors (AI offline, missing model) come back as normal JSON errors.
// Errors after the response has started are added to the end of the text.
export async function sendStream(reply: FastifyReply, stream: AsyncGenerator<string>, header = '') {
  const first = header ? null : await stream.next();
  reply.header('Content-Type', 'text/plain; charset=utf-8');
  return reply.send(Readable.from(continueStream(header, first, stream)));
}

async function* continueStream(
  header: string,
  first: IteratorResult<string> | null,
  rest: AsyncGenerator<string>,
) {
  if (header) yield header;
  try {
    if (first) {
      if (first.done) return;
      yield first.value;
    }
    yield* rest;
  } catch (error: any) {
    yield `\n\n[Error: ${error?.message ?? 'the AI stopped responding'}]`;
  }
}
