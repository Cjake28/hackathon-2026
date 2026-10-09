// `npm run demo:reset -- --yes`: back to a clean demo. Deletes every chat, document and item (users, roles and
// settings stay), then re-seeds the demo data and re-indexes api/rag-data. Back up first if anything matters.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
if (!process.argv.includes('--yes')) {
  console.error('Usage: npm run demo:reset -- --yes   (deletes all chats, documents and items)');
  process.exit(1);
}

const check = (result) => result.status === 0 || process.exit(result.status ?? 1);
const npm = (script) => check(spawnSync(`npm run ${script}`, { cwd: join(root, 'api'), stdio: 'inherit', shell: true }));

const sql = 'TRUNCATE "ConversationMessage", "Conversation", "DocumentChunk", "Document", "Item" RESTART IDENTITY CASCADE';
check(spawnSync('docker', ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'hackathon', '-q', '-c', sql], { cwd: root, stdio: 'inherit' }));
console.log('✔ Chats, documents and items deleted');
npm('db:seed');
npm('rag:ingest'); // needs Ollama running (embeddings)
console.log('✔ Demo data is fresh');
