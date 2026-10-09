// `npm run restore -- backups/<file>.sql --yes`: replaces the whole database with a backup from `npm run backup`.
// The current data is backed up first, and the restore is all-or-nothing.
import { spawn, spawnSync } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = join(import.meta.dirname, '..');
const file = process.argv.slice(2).find((a) => a.endsWith('.sql'));
if (!file || !existsSync(resolve(root, file)) || !process.argv.includes('--yes')) {
  console.error('Usage: npm run restore -- backups/<file>.sql --yes   (replaces ALL current data)');
  process.exit(1);
}

console.log('Backing up the current data first…');
if (spawnSync('node', [join(root, 'scripts', 'backup.mjs')], { stdio: 'inherit' }).status !== 0) process.exit(1);

const psql = spawn(
  'docker',
  ['compose', 'exec', '-T', 'db', 'psql', '-U', 'postgres', '-d', 'hackathon', '-q', '--single-transaction', '-v', 'ON_ERROR_STOP=1'],
  { cwd: root, stdio: ['pipe', 'ignore', 'inherit'] },
);
createReadStream(resolve(root, file)).pipe(psql.stdin);
psql.on('close', (code) => {
  if (code !== 0) {
    console.error('Restore failed; nothing was changed.');
    process.exit(1);
  }
  console.log(`✔ Restored ${file}. Restart the API (or the hub) so it reloads its settings.`);
});
