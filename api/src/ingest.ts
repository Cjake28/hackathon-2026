import './env';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { AiService } from './ai/ai.service';
import { PrismaService } from './prisma.service';
import { RAG } from './rag/rag.config';
import { RagService } from './rag/rag.service';

// `npm run rag:ingest` indexes every PDF/TXT/Markdown file in api/rag-data (a file with the same name is replaced).
async function main() {
  const prisma = new PrismaService();
  const rag = new RagService(prisma, new AiService());
  const dir = resolve('rag-data');
  const files = readdirSync(dir).filter((f) => RAG.fileTypes.test(f));
  for (const file of files) {
    const doc = await rag.ingest(file, readFileSync(join(dir, file)));
    console.log(`✔ ${file}: ${doc.chunks} chunks`);
  }
  console.log(files.length ? `Done: ${files.length} file(s)` : `No PDF/TXT/MD files in ${dir}`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
