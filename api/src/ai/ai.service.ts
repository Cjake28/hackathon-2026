import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  OnApplicationBootstrap,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Ollama, type Message, type Tool } from 'ollama';
import { z } from 'zod';
import { PrismaService } from '../prisma.service';

// `images`: base64 pictures for vision models (see status().vision).
export type ChatMessage = { role: 'user' | 'assistant'; content: string; images?: string[] };
export type { Message as AiMessage, Tool as AiTool };

// Local AI (Ollama on the hub). Settings in api/.env.
const HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.AI_MODEL || 'qwen3.5:2b'; // admins can switch on the web AI Settings page
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'embeddinggemma';
const THINK = process.env.AI_THINK === 'true'; // step-by-step reasoning: smarter, but much slower on small machines
const CONTEXT = Number(process.env.AI_CONTEXT || 8192); // tokens the model can see at once (more = more memory)
const KEEP_ALIVE = process.env.AI_KEEP_ALIVE || '30m'; // keep the model loaded so answers start fast
// Model layers on the GPU (Ollama num_gpu). Unset = Ollama decides, which is cautious on small GPUs: on the hub laptop
// (RTX 3050, 4 GB) it kept half of qwen3.5:4b on the CPU (14 tokens/s, 6 s per voice turn); 99 = all layers (36
// tokens/s, 2 s). When set, embeddings run on the CPU so they never push the chat model off the GPU.
const GPU_LAYERS = process.env.AI_GPU_LAYERS ? Number(process.env.AI_GPU_LAYERS) : undefined;
const FACTUAL = { temperature: 0.2 }; // text() and json(): stick to the facts (RAG, extraction). chat() keeps the model's default.
const EMBED_OPTIONS = GPU_LAYERS === undefined ? undefined : { num_gpu: 0 };
export const EMBEDDING_DIMENSIONS = 768; // keep in sync with vector(768) in schema.prisma

// Every AI call goes through here. Only the API talks to Ollama; web/mobile call the API.
@Injectable()
export class AiService implements OnApplicationBootstrap {
  private ollama = new Ollama({ host: HOST });
  private model = DEFAULT_MODEL; // the chat model in use
  private thinkSupported = true; // turned off if the model rejects the `think` option

  constructor(private prisma: PrismaService) {}

  // Use the model an admin picked (if any), then load both models in the background so the first question
  // doesn't wait for it.
  async onApplicationBootstrap() {
    const saved = await this.prisma.setting.findUnique({ where: { key: 'ai.model' } }).catch(() => null);
    if (saved) this.model = saved.value;
    void this.warmUp();
  }

  private warmUp() {
    return this.ollama
      .generate({ model: this.model, prompt: '', keep_alive: KEEP_ALIVE, options: this.base().options }) // same options: no reload later
      .then(() => this.ollama.embed({ model: EMBEDDING_MODEL, input: 'warm up', keep_alive: KEEP_ALIVE, options: EMBED_OPTIONS }))
      .then(() => console.log(`[ai] ${this.model} and ${EMBEDDING_MODEL} are loaded`))
      .catch(() => {}); // Ollama offline or a model missing: the AI status badge explains it
  }

  // Downloaded chat models (embedding-only models left out), for the AI Settings page.
  async listModels() {
    const { models } = await this.call(() => this.ollama.list());
    const details = await Promise.all(
      models.map(async (m) => {
        const capabilities = (await this.ollama.show({ model: m.name }).catch(() => null))?.capabilities ?? [];
        return {
          name: m.name,
          sizeGb: Math.round((m.size / 1e9) * 10) / 10,
          capabilities,
          active: m.name === this.model || m.name === `${this.model}:latest`,
        };
      }),
    );
    return details.filter((m) => m.capabilities.includes('completion'));
  }

  // Switch the chat model for everyone (saved, so it survives restarts). The old model is unloaded to free memory.
  async setModel(name: string) {
    const model = (await this.listModels()).find((m) => m.name === name);
    if (!model) throw new BadRequestException(`${name} isn't downloaded on the hub. Run: ollama pull ${name}`);
    const previous = this.model;
    await this.prisma.setting.upsert({ where: { key: 'ai.model' }, update: { value: name }, create: { key: 'ai.model', value: name } });
    this.model = name;
    this.thinkSupported = true;
    if (previous !== name) void this.ollama.generate({ model: previous, prompt: '', keep_alive: 0 }).catch(() => {});
    void this.warmUp();
    return this.status();
  }

  // Plain text answer.
  async text(prompt: string, system?: string) {
    const res = await this.chatOnce(withSystem([{ role: 'user', content: prompt }], system));
    return res.message.content;
  }

  // JSON that matches a zod schema: `await ai.json(prompt, z.object({ ... }))` returns typed data.
  // `images`: base64 pictures for vision models (e.g. chore before/after photos).
  async json<T extends z.ZodType>(prompt: string, schema: T, system?: string, images?: string[]): Promise<z.infer<T>> {
    const { $schema, ...format } = z.toJSONSchema(schema) as Record<string, unknown>;
    const res = await this.chatOnce(withSystem([{ role: 'user', content: prompt, images }], system), format);
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
    } finally {
      stream.abort(); // the user stopped or left: tell Ollama to stop generating (frees the hub's AI)
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
          options: EMBED_OPTIONS,
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
    const base = { model: this.model, embeddingModel: EMBEDDING_MODEL, vision: false, tools: false };
    try {
      const { models } = await this.ollama.list();
      const names = models.map((m) => m.name);
      const has = (model: string) => names.includes(model) || names.includes(`${model}:latest`);
      const missing = [this.model, EMBEDDING_MODEL].filter((m) => !has(m));
      const capabilities = has(this.model) ? (await this.ollama.show({ model: this.model })).capabilities ?? [] : [];
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
      model: this.model,
      keep_alive: KEEP_ALIVE,
      options: { num_ctx: CONTEXT, ...(GPU_LAYERS === undefined ? {} : { num_gpu: GPU_LAYERS }), ...options },
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
