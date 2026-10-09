// Shared by the hub, `npm run ai` and the benchmark: Ollama settings from api/.env.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

if (existsSync('api/.env')) process.loadEnvFile('api/.env');

export const OLLAMA = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
export const MODEL = process.env.AI_MODEL || 'qwen3.5:2b';
export const EMBEDDING_MODEL = process.env.AI_EMBEDDING_MODEL || 'embeddinggemma';

// The options the API sends with every chat (api/src/ai/ai.service.ts): same context size and GPU layers, so the
// benchmark measures the speed the app really gets.
export const CHAT_OPTIONS = {
  num_ctx: Number(process.env.AI_CONTEXT || 8192),
  ...(process.env.AI_GPU_LAYERS ? { num_gpu: Number(process.env.AI_GPU_LAYERS) } : {}),
};

// The Ollama program (Windows installs it in AppData; elsewhere it's on the PATH).
const windowsExe = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe');
export const ollamaExe = process.platform === 'win32' && existsSync(windowsExe) ? windowsExe : 'ollama';

// Environment for `ollama serve`: answers in parallel (AI_PARALLEL) and Ollama's cloud models switched off.
export const ollamaEnv = {
  ...process.env,
  OLLAMA_NUM_PARALLEL: process.env.AI_PARALLEL || '1',
  OLLAMA_NO_CLOUD: '1',
};

// Downloaded model names, or null when Ollama isn't running.
export const installedModels = () =>
  fetch(`${OLLAMA}/api/tags`, { signal: AbortSignal.timeout(3000) })
    .then((res) => res.json())
    .then((body) => body.models.map((m) => m.name))
    .catch(() => null);

export const isInstalled = (names, model) => names.includes(model) || names.includes(`${model}:latest`);
