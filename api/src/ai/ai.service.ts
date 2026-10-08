import {
  BadGatewayException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { z } from 'zod';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Models are set in api/.env (AI_MODEL, AI_EMBEDDING_MODEL).
const MODEL = process.env.AI_MODEL || 'gemini-3.8-flash';
const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 768; // keep in sync with vector(768) in schema.prisma
const COOLDOWN_MS = 60_000; // a provider that hit its rate limit is tried last for this long

type JsonSchema = Record<string, unknown>;

// One AI backend. Every provider can chat; only Gemini can embed (RAG vectors must all come from one model).
type Provider = {
  name: string;
  text(prompt: string, system?: string): Promise<string>;
  json(prompt: string, schema: JsonSchema, system?: string): Promise<string>;
  chat(messages: ChatMessage[], system?: string): AsyncGenerator<string>;
  embed?(texts: string[], kind: 'document' | 'query'): Promise<number[][]>;
};

// Every AI call goes through here. Providers are tried in order; when one fails (rate limit, error, outage)
// the next one answers. Configure them in api/.env:
//   1. Gemini: GEMINI_API_KEY (or Vertex AI with GOOGLE_GENAI_USE_VERTEXAI=true)
//   2. Gemini backup: GEMINI_API_KEY_BACKUP and/or AI_MODEL_BACKUP
//   3. Any OpenAI-compatible API (OpenAI, Groq, OpenRouter, ...): BACKUP_AI_API_KEY + BACKUP_AI_MODEL (+ BACKUP_AI_BASE_URL)
// Never call the AI from web/mobile (the keys would leak).
@Injectable()
export class AiService {
  private providers = buildProviders();
  private cooldownUntil = new Map<string, number>();

  // Plain text answer.
  text(prompt: string, system?: string) {
    return this.withFallback('text', (p) => p.text(prompt, system));
  }

  // JSON that matches a zod schema: `await ai.json(prompt, z.object({ ... }))` returns typed data.
  json<T extends z.ZodType>(prompt: string, schema: T, system?: string): Promise<z.infer<T>> {
    const { $schema, ...jsonSchema } = z.toJSONSchema(schema) as JsonSchema;
    return this.withFallback('json', async (p) => {
      const parsed = schema.safeParse(parseJson(await p.json(prompt, jsonSchema, system)));
      if (!parsed.success) throw new BadGatewayException('The AI returned an unexpected answer. Try again.');
      return parsed.data;
    });
  }

  // Streams a chat reply piece by piece. Falls back only before the first piece arrives.
  async *chat(messages: ChatMessage[], system?: string): AsyncGenerator<string> {
    const { first, rest } = await this.withFallback('chat', async (p) => {
      const stream = p.chat(messages, system);
      return { first: await stream.next(), rest: stream };
    });
    if (first.done) return;
    yield first.value;
    try {
      yield* rest;
    } catch (error) {
      throw toHttpError(error);
    }
  }

  // Embeddings for RAG: 'document' for stored chunks, 'query' for questions.
  embed(texts: string[], kind: 'document' | 'query') {
    if (this.providers.length && !this.providers.some((p) => p.embed)) {
      throw new ServiceUnavailableException('RAG needs a Gemini key (GEMINI_API_KEY or GEMINI_API_KEY_BACKUP) for embeddings.');
    }
    return this.withFallback('embed', (p) => p.embed!(texts, kind), (p) => !!p.embed);
  }

  private async withFallback<T>(
    task: string,
    call: (provider: Provider) => Promise<T>,
    canDo: (provider: Provider) => boolean = () => true,
  ): Promise<T> {
    const now = Date.now();
    const cooling = (p: Provider) => (this.cooldownUntil.get(p.name) ?? 0) > now;
    // Providers on cooldown go last (still tried, in case everything else is down).
    const candidates = this.providers.filter(canDo).sort((a, b) => Number(cooling(a)) - Number(cooling(b)));
    if (!candidates.length) {
      throw new ServiceUnavailableException('AI is not configured. Set GEMINI_API_KEY in api/.env.');
    }

    let lastError: unknown;
    for (const [i, provider] of candidates.entries()) {
      try {
        const result = await call(provider);
        if (i > 0) console.warn(`[ai] ${task}: answered by backup "${provider.name}"`);
        return result;
      } catch (error: any) {
        lastError = error;
        if (error?.status === 429) this.cooldownUntil.set(provider.name, Date.now() + COOLDOWN_MS);
        console.warn(`[ai] ${task}: "${provider.name}" failed (${error?.status ?? 'error'}): ${errorMessage(error)}`);
      }
    }
    throw toHttpError(lastError);
  }
}

function buildProviders(): Provider[] {
  const env = process.env;
  const providers: Provider[] = [];

  const vertex = env.GOOGLE_GENAI_USE_VERTEXAI === 'true';
  const primaryConfigured = vertex ? !!env.GOOGLE_CLOUD_PROJECT : !!(env.GEMINI_API_KEY || env.GOOGLE_API_KEY);
  // The SDK reads the key / Vertex settings from the environment.
  const primary = primaryConfigured ? new GoogleGenAI({}) : null;
  if (primary) providers.push(gemini('gemini', primary, MODEL, vertex));

  if (env.GEMINI_API_KEY_BACKUP) {
    const backup = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY_BACKUP, vertexai: false });
    providers.push(gemini('gemini-backup', backup, env.AI_MODEL_BACKUP || MODEL, false));
  } else if (primary && env.AI_MODEL_BACKUP) {
    // Same key, another model: Gemini rate limits are per model.
    providers.push(gemini('gemini-backup-model', primary, env.AI_MODEL_BACKUP, vertex));
  }

  if (env.BACKUP_AI_API_KEY && env.BACKUP_AI_MODEL) {
    const client = new OpenAI({
      apiKey: env.BACKUP_AI_API_KEY,
      baseURL: env.BACKUP_AI_BASE_URL || undefined,
      maxRetries: 1,
    });
    providers.push(openAiCompatible('backup-ai', client, env.BACKUP_AI_MODEL));
  }
  return providers;
}

function gemini(name: string, client: GoogleGenAI, model: string, vertex: boolean): Provider {
  return {
    name,
    async text(prompt, system) {
      const res = await client.models.generateContent({ model, contents: prompt, config: { systemInstruction: system } });
      return res.text ?? '';
    },
    async json(prompt, schema, system) {
      const res = await client.models.generateContent({
        model,
        contents: prompt,
        config: { systemInstruction: system, responseMimeType: 'application/json', responseJsonSchema: schema },
      });
      return res.text ?? '';
    },
    async *chat(messages, system) {
      const stream = await client.models.generateContentStream({
        model,
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        config: { systemInstruction: system },
      });
      for await (const chunk of stream) if (chunk.text) yield chunk.text;
    },
    async embed(texts, kind) {
      // Vertex takes one text per embedding request for this model; the Gemini API takes up to 100.
      const batch = vertex ? 1 : 100;
      const vectors: number[][] = [];
      for (let i = 0; i < texts.length; i += batch) {
        const res = await client.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: texts.slice(i, i + batch),
          config: {
            taskType: kind === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
            outputDimensionality: EMBEDDING_DIMENSIONS,
          },
        });
        vectors.push(...(res.embeddings ?? []).map((e) => normalize(e.values ?? [])));
      }
      return vectors;
    },
  };
}

function openAiCompatible(name: string, client: OpenAI, model: string): Provider {
  const withSystem = (messages: ChatMessage[], system?: string): OpenAI.Chat.ChatCompletionMessageParam[] => [
    ...(system ? [{ role: 'system' as const, content: system }] : []),
    ...messages,
  ];
  return {
    name,
    async text(prompt, system) {
      const res = await client.chat.completions.create({
        model,
        messages: withSystem([{ role: 'user', content: prompt }], system),
      });
      return res.choices[0]?.message?.content ?? '';
    },
    async json(prompt, schema, system) {
      const instructions = `${system ?? ''}\nReply with JSON only, matching this JSON schema: ${JSON.stringify(schema)}`;
      const res = await client.chat.completions.create({
        model,
        messages: withSystem([{ role: 'user', content: prompt }], instructions.trim()),
        response_format: { type: 'json_object' },
      });
      return res.choices[0]?.message?.content ?? '';
    },
    async *chat(messages, system) {
      const stream = await client.chat.completions.create({ model, messages: withSystem(messages, system), stream: true });
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) yield text;
      }
    },
  };
}

// Readable message from Gemini/OpenAI errors (Gemini's can be JSON inside JSON).
function errorMessage(error: any) {
  let message = String(error?.message ?? error);
  for (let i = 0; i < 3; i++) {
    try {
      const inner = JSON.parse(message).error?.message;
      if (typeof inner !== 'string') break;
      message = inner;
    } catch {
      break;
    }
  }
  return message.replace(/\s+/g, ' ').trim();
}

// AI errors become 429 (rate limit) or 502 with the provider's message. Never 401: that would log the user out.
function toHttpError(error: any) {
  if (error instanceof HttpException) return error;
  if (error?.status === 429) return new HttpException('The AI is busy (rate limit). Try again in a minute.', 429);
  return new BadGatewayException(`AI request failed: ${errorMessage(error)}`);
}

function parseJson(text?: string) {
  try {
    return JSON.parse(text ?? '');
  } catch {
    return undefined;
  }
}

// Shortened Gemini embeddings must be normalized before comparing them.
function normalize(values: number[]) {
  const length = Math.hypot(...values) || 1;
  return values.map((v) => v / length);
}
