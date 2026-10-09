import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma.service';
import { RAG } from './rag.config';

type Page = { page: number | null; text: string };
type Match = { documentId: number; title: string; page: number | null; content: string; score: number };

// RAG = find the chunks closest in meaning to the question (pgvector), then let the AI answer from them.
@Injectable()
export class RagService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
  ) {}

  list() {
    return this.prisma.document.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { chunks: true } } },
    });
  }

  remove(id: number) {
    return this.prisma.document.delete({ where: { id } });
  }

  // File → text → chunks → embeddings → database. A file with the same name is replaced.
  async ingest(filename: string, data: Buffer) {
    if (!RAG.fileTypes.test(filename)) throw new BadRequestException('Only PDF, TXT and Markdown files are supported');
    if (data.length > RAG.maxFileMb * 1024 * 1024) throw new BadRequestException(`Max file size is ${RAG.maxFileMb} MB`);

    const chunks = splitIntoChunks(await extractPages(filename, data));
    if (!chunks.length) throw new BadRequestException('No text found in this file (scanned PDFs are not supported)');
    const vectors = await this.ai.embed(chunks.map((c) => c.content), 'document');

    return this.prisma.$transaction(async (tx) => {
      await tx.document.deleteMany({ where: { source: filename } });
      const doc = await tx.document.create({ data: { title: filename.replace(/\.[^.]+$/, ''), source: filename } });
      // Prisma can't write vector columns, so chunks go in with raw SQL (100 rows per statement).
      for (let i = 0; i < chunks.length; i += 100) {
        const rows = chunks.slice(i, i + 100).map(
          (c, j) =>
            Prisma.sql`(${doc.id}, ${i + j}, ${c.page}, ${c.content}, ${toVector(vectors[i + j])}::vector)`,
        );
        await tx.$executeRaw`INSERT INTO "DocumentChunk" ("documentId", "index", "page", "content", "embedding") VALUES ${Prisma.join(rows)}`;
      }
      return { ...doc, chunks: chunks.length };
    });
  }

  // Whole answer at once: { answer, sources }. Use this inside other features.
  async ask(question: string) {
    const { sources, prompt } = await this.retrieve(question);
    if (!prompt) return { answer: NOT_FOUND, sources };
    return { answer: await this.ai.text(prompt, RAG.system), sources };
  }

  // For the UI: the sources right away, then the answer streamed piece by piece.
  async askStream(question: string) {
    const { sources, prompt } = await this.retrieve(question);
    return { sources, answer: prompt ? this.ai.textStream(prompt, RAG.system) : once(NOT_FOUND) };
  }

  // Finds the chunks closest in meaning to the question and builds the prompt with numbered sources.
  private async retrieve(question: string) {
    if (!question?.trim()) throw new BadRequestException('Ask a question first');
    const [query] = await this.ai.embed([question], 'query');
    const vector = toVector(query);
    const matches = await this.prisma.$queryRaw<Match[]>`
      SELECT d.id AS "documentId", d.title, c.page, c.content,
             1 - (c.embedding <=> ${vector}::vector) AS score
      FROM "DocumentChunk" c JOIN "Document" d ON d.id = c."documentId"
      ORDER BY c.embedding <=> ${vector}::vector
      LIMIT ${RAG.topK}`;
    const found = matches.filter((m) => Number(m.score) >= RAG.minScore);

    const sources = found.map((s, i) => ({
      n: i + 1,
      documentId: s.documentId,
      title: s.title,
      page: s.page,
      snippet: s.content.slice(0, 300),
      score: Number(s.score),
    }));
    const context = found
      .map((s, i) => `[${i + 1}] ${s.title}${s.page ? ` (page ${s.page})` : ''}\n${s.content}`)
      .join('\n\n');
    const prompt = found.length ? `Sources:\n\n${context}\n\nQuestion: ${question}` : null;
    return { sources, prompt };
  }
}

const NOT_FOUND = "I couldn't find anything about that in the documents.";

async function* once(text: string) {
  yield text;
}

async function extractPages(filename: string, data: Buffer): Promise<Page[]> {
  if (/\.pdf$/i.test(filename)) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(data)), { mergePages: false });
    return text.map((t, i) => ({ page: i + 1, text: t }));
  }
  return [{ page: null, text: data.toString('utf8') }];
}

// Splits each page into ~chunkSize pieces, ending at a paragraph, sentence or word where possible.
function splitIntoChunks(pages: Page[]) {
  const chunks: { page: number | null; content: string }[] = [];
  for (const { page, text } of pages) {
    const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(start + RAG.chunkSize, clean.length);
      if (end < clean.length) {
        const window = clean.slice(start, end);
        const cut = Math.max(window.lastIndexOf('\n\n'), window.lastIndexOf('. '), window.lastIndexOf(' '));
        if (cut > RAG.chunkSize * 0.5) end = start + cut + 1;
      }
      const content = clean.slice(start, end).trim();
      if (content) chunks.push({ page, content });
      if (end >= clean.length) break;
      start = Math.max(end - RAG.chunkOverlap, start + 1);
    }
  }
  return chunks;
}

const toVector = (values: number[]) => `[${values.join(',')}]`;
