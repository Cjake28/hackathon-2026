import {
  BadGatewayException,
  HttpException,
  Injectable,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Ollama, type Message, type Tool } from 'ollama';
import { z } from 'zod';

// `images`: base64 pictures for vision models (see status().vision).
export type ChatMessage = { role: 'user' | 'assistant'; content: string; images?: string[] };
export type { Message as AiMessage, Tool as AiTool };

// Local AI (Ollama on the hub). Settings in api/.env.
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const MODEL = process.env.AI_MODEL || 'qwen3.5:2b';
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'embeddinggemma';
const THINK = process.env.AI_THINK === 'true'; // step-by-step reasoning: smarter, but much slower on small machines
const CONTEXT = Number(process.env.AI_CONTEXT || 8192); // tokens the model can see at once (more = more memory)
const KEEP_ALIVE = process.env.AI_KEEP_ALIVE || '30m'; // keep the model loaded so answers start fast
const FACTUAL = { temperature: 0.2 }; // text() and json(): stick to the facts (RAG, extraction). chat() keeps the model's default.
export const EMBEDDING_DIMENSIONS = 768; // keep in sync with vector(768) in schema.prisma

// Every AI call goes through here. Only the API talks to Ollama; web/mobile call the API.
@Injectable()
export class AiService implements OnApplicationBootstrap {
  private ollama = new Ollama({ host: HOST });
  private thinkSupported = true; // turned off if the model rejects the `think` option

  // Load both models in the background at startup, so the first question doesn't wait for it.
  onApplicationBootstrap() {
    void this.ollama
      .generate({ model: MODEL, prompt: '', keep_alive: KEEP_ALIVE })
      .then(() => this.ollama.embed({ model: EMBEDDING_MODEL, input: 'warm up', keep_alive: KEEP_ALIVE }))
      .then(() => console.log(`[ai] ${MODEL} and ${EMBEDDING_MODEL} are loaded`))
      .catch(() => {}); // Ollama offline or a model missing: the AI status badge explains it
  }

  // Plain text answer.
  async text(prompt: string, system?: string) {
    const res = await this.chatOnce(withSystem([{ role: 'user', content: prompt }], system));
    return res.message.content;
  }

  // JSON that matches a zod schema: `await ai.json(prompt, z.object({ ... }))` returns typed data.
  async json<T extends z.ZodType>(prompt: string, schema: T, system?: string): Promise<z.infer<T>> {
    const { $schema, ...format } = z.toJSONSchema(schema) as Record<string, unknown>;
    const res = await this.chatOnce(withSystem([{ role: 'user', content: prompt }], system), format);
    const parsed = schema.safeParse(parseJson(res.message.content));
    if (!parsed.success) throw new BadGatewayException('The AI returned an unexpected answer. Try again.');
    return parsed.data;
  }

  // Streams a chat reply piece by piece.
  chat(messages: ChatMessage[], system?: string) {
    return this.stream(withSystem(messages, system));
  }

  // Like text(), but streamed piece by piece (e.g. RAG answers).
  textStream(prompt: string, system?: string) {
    return this.stream(withSystem([{ role: 'user', content: prompt }], system), FACTUAL);
  }

  private async *stream(messages: Message[], options: Record<string, number> = {}): AsyncGenerator<string> {
    const stream = await this.call(() =>
      this.ollama.chat({ ...this.base(options), messages, stream: true }),
    );
    try {
      for await (const part of stream) if (part.message.content) yield part.message.content;
    } catch (error) {
      throw toHttpError(error);
    }
  }

  // Embeddings for RAG: 'document' for stored chunks, 'query' for questions.
  async embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
    const prefix = embeddingPrefix(kind);
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i += 32) {
      const res = await this.call(() =>
        this.ollama.embed({
          model: EMBEDDING_MODEL,
          input: texts.slice(i, i + 32).map((t) => prefix + t),
          keep_alive: KEEP_ALIVE,
        }),
      );
      vectors.push(...res.embeddings);
    }
    if (vectors.length && vectors[0].length !== EMBEDDING_DIMENSIONS) {
      throw new BadGatewayException(
        `${EMBEDDING_MODEL} returns ${vectors[0].length} numbers per text; the database expects ${EMBEDDING_DIMENSIONS}. Use a 768-dimension embedding model.`,
      );
    }
    return vectors;
  }

  // One step of a tool-using AI: returns the model's message, which may contain `tool_calls`.
  async toolStep(messages: Message[], tools: Tool[]) {
    const res = await this.call(() =>
      this.ollama.chat({ ...this.base(FACTUAL), messages, tools, stream: false }),
    );
    return res.message;
  }

  // For the UI: is Ollama running, are both models downloaded, and can the chat model see images / use tools?
  async status() {
    const base = { model: MODEL, embeddingModel: EMBEDDING_MODEL, vision: false, tools: false };
    try {
      const { models } = await this.ollama.list();
      const names = models.map((m) => m.name);
      const has = (model: string) => names.includes(model) || names.includes(`${model}:latest`);
      const missing = [MODEL, EMBEDDING_MODEL].filter((m) => !has(m));
      const capabilities = has(MODEL) ? (await this.ollama.show({ model: MODEL })).capabilities ?? [] : [];
      return {
        ...base,
        online: true,
        missing,
        vision: capabilities.includes('vision'),
        tools: capabilities.includes('tools'),
      };
    } catch {
      return { ...base, online: false, missing: [] as string[] };
    }
  }

  private base(options: Record<string, number> = {}) {
    return {
      model: MODEL,
      keep_alive: KEEP_ALIVE,
      options: { num_ctx: CONTEXT, ...options },
      ...(this.thinkSupported ? { think: THINK } : {}),
    };
  }

  private async chatOnce(messages: Message[], format?: Record<string, unknown>) {
    return this.call(() => this.ollama.chat({ ...this.base(FACTUAL), messages, format, stream: false }));
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error: any) {
      // Models without a thinking mode reject the `think` option: drop it and retry once.
      if (this.thinkSupported && /does not support thinking/i.test(String(error?.message))) {
        this.thinkSupported = false;
        return this.call(request);
      }
      throw toHttpError(error);
    }
  }
}

const withSystem = (messages: ChatMessage[], system?: string): Message[] => [
  ...(system ? [{ role: 'system', content: system }] : []),
  ...messages,
];

// Embedding models give better search results with their own prefixes. Add yours if you switch models.
function embeddingPrefix(kind: 'document' | 'query') {
  if (EMBEDDING_MODEL.startsWith('embeddinggemma')) {
    return kind === 'document' ? 'title: none | text: ' : 'task: search result | query: ';
  }
  if (EMBEDDING_MODEL.startsWith('nomic-embed-text')) {
    return kind === 'document' ? 'search_document: ' : 'search_query: ';
  }
  return '';
}

// Ollama down → 503 with what to do; missing model → 503 with the pull command; anything else → 502.
function toHttpError(error: any) {
  if (error instanceof HttpException) return error;
  const message = String(error?.message ?? error);
  if (/fetch failed|ECONNREFUSED/i.test(message) || error?.cause?.code === 'ECONNREFUSED') {
    return new ServiceUnavailableException(
      'The local AI is offline. On the hub, open the Ollama app (or run `ollama serve`).',
    );
  }
  if (error?.status_code === 404 && /model/i.test(message)) {
    return new ServiceUnavailableException(`${message}. On the hub, run: ollama pull <model name>`);
  }
  return new BadGatewayException(`AI request failed: ${message}`);
}

function parseJson(text?: string) {
  try {
    return JSON.parse(text ?? '');
  } catch {
    return undefined;
  }
}
