// `npm run hub`: run the whole app from this computer for every device on the same Wi-Fi / LAN.
// Starts Ollama if needed, builds the web app, then the API serves it: other devices open http://<this-ip>:4101.
import { spawn, spawnSync } from 'node:child_process';
import { EMBEDDING_MODEL, MODEL, OLLAMA, installedModels, isInstalled, ollamaEnv, ollamaExe } from './ollama.mjs';

// 1. Local AI: start `ollama serve` if it isn't running, then check the models.
let names = await installedModels();
if (!names) {
  console.log(`Starting Ollama (answers at the same time: ${ollamaEnv.OLLAMA_NUM_PARALLEL})…`);
  spawn(ollamaExe, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true, env: ollamaEnv })
    .on('error', () => {})
    .unref();
  for (let i = 0; i < 15 && !names; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    names = await installedModels();
  }
}
if (!names) {
  console.warn(`⚠ Ollama isn't running at ${OLLAMA}. Install it from https://ollama.com and run "npm run ai".`);
} else {
  const missing = [MODEL, EMBEDDING_MODEL].filter((m) => !isInstalled(names, m));
  if (missing.length) console.warn(`⚠ Download these models first: ${missing.map((m) => `ollama pull ${m}`).join(' && ')}`);
  else console.log(`✔ Local AI ready (${MODEL}, ${EMBEDDING_MODEL}). The API loads them at startup.`);
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
