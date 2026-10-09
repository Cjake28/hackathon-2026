// `npm run hub`: run the whole app from this computer for every device on the same Wi-Fi / LAN.
// Starts Ollama if needed, builds the web app, then the API serves it: other devices open http://<this-ip>:4101.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (existsSync('api/.env')) process.loadEnvFile('api/.env');
const ollama = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const models = [process.env.AI_MODEL || 'qwen3.5:2b', process.env.AI_EMBEDDING_MODEL || 'embeddinggemma'];

const tags = () =>
  fetch(`${ollama}/api/tags`, { signal: AbortSignal.timeout(3000) })
    .then((res) => res.json())
    .catch(() => null);

// 1. Local AI: start `ollama serve` if it isn't running, then check the models.
let list = await tags();
if (!list) {
  const windowsExe = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe');
  const exe = process.platform === 'win32' && existsSync(windowsExe) ? windowsExe : 'ollama';
  console.log('Starting Ollama…');
  spawn(exe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).on('error', () => {}).unref();
  for (let i = 0; i < 15 && !list; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    list = await tags();
  }
}
if (!list) {
  console.warn(`⚠ Ollama isn't running at ${ollama}. Install it from https://ollama.com and run "ollama serve".`);
} else {
  const names = list.models.map((m) => m.name);
  const missing = models.filter((m) => !names.includes(m) && !names.includes(`${m}:latest`));
  if (missing.length) console.warn(`⚠ Download these models first: ${missing.map((m) => `ollama pull ${m}`).join(' && ')}`);
  else console.log(`✔ Local AI ready (${models.join(', ')})`);
}

// 2. Build the web app and the API.
const run = (command, cwd) => {
  const result = spawnSync(command, { cwd, stdio: 'inherit', shell: true });
  if (result.status !== 0) process.exit(result.status ?? 1);
};
run('npm run build', 'web');
run('npm run build', 'api');

// 3. Start the API in production mode, serving the web app too.
console.log("\nStarting the hub… (Windows: if other devices can't connect, allow Node.js in Windows Firewall)");
spawn('node dist/main', {
  cwd: 'api',
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production', SERVE_WEB: 'true' },
});
