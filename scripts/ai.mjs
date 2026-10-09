// `npm run ai`: runs the local AI server (ollama serve) with this project's settings. Ctrl+C to stop.
import { spawn } from 'node:child_process';
import { installedModels, ollamaEnv, ollamaExe } from './ollama.mjs';

if (await installedModels()) {
  console.log('Ollama is already running. (AI_PARALLEL only applies when Ollama is started from here or by the hub.)');
  process.exit(0);
}
spawn(ollamaExe, ['serve'], { stdio: 'inherit', env: ollamaEnv }).on('error', () => {
  console.error('Ollama is not installed. Get it from https://ollama.com/download');
  process.exit(1);
});
