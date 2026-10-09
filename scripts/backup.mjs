// `npm run backup`: saves the whole database (users, chats, documents, everything) to backups/hackathon-<time>.sql.
// Restore it with `npm run restore -- backups/<file>.sql --yes`.
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
const file = join('backups', `hackathon-${stamp}.sql`);
mkdirSync(join(root, 'backups'), { recursive: true });

const out = createWriteStream(join(root, file));
const dump = spawn('docker', ['compose', 'exec', '-T', 'db', 'pg_dump', '-U', 'postgres', '--clean', '--if-exists', 'hackathon'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
});
dump.stdout.pipe(out);
dump.on('error', () => {
  console.error('Docker is not running. Start it, then `npm run db:up`.');
  process.exit(1);
});
dump.on('close', (code) => {
  out.close();
  if (code !== 0) {
    console.error('Backup failed. Is the database running? (`npm run db:up`)');
    process.exit(1);
  }
  console.log(`✔ Saved ${file} (${Math.round(statSync(join(root, file)).size / 1024)} KB)`);
});
