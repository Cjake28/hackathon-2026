// `npm run ai:bench -- qwen3.5:4b gemma4:e4b` (no names = AI_MODEL from api/.env)
// `npm run ai:bench -- --gpu=auto` / `--gpu=99`: override AI_GPU_LAYERS (auto = let Ollama decide) to compare.
// Asks every model the same questions (English + Tagalog + a JSON task + a Jarvis tool call) and compares speed,
// how much of the model is on the GPU, and the answers. Uses the API's settings (AI_CONTEXT, AI_GPU_LAYERS).
// Answers are saved to ai-bench.md so you can read them side by side.
import { writeFileSync } from 'node:fs';
import { CHAT_OPTIONS, MODEL, OLLAMA, installedModels, isInstalled } from './ollama.mjs';

const QUESTIONS = [
  'What is photosynthesis? Answer in 2 sentences.',
  'Ano ang photosynthesis? Sagutin sa 2 pangungusap.',
  'Who was José Rizal and why is he important? Answer in 2 sentences.',
  'Sino si Andres Bonifacio? Sagutin nang maikli.',
  "Explain Newton's second law with a simple example.",
  'Ipaliwanag ang supply and demand sa simpleng salita.',
  'Someone is choking. List the first 3 things to do.',
];
const QUIZ_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          choices: { type: 'array', items: { type: 'string' } },
          answer: { type: 'string' },
        },
        required: ['question', 'choices', 'answer'],
      },
    },
  },
  required: ['questions'],
};
const QUIZ_PROMPT = 'Write 3 multiple-choice quiz questions about the water cycle, 4 choices each.';

// A Jarvis turn (api/src/voice/voice.controller.ts): the AI must call set_alarm for Ana with inMinutes 4.
const JARVIS_SYSTEM =
  "You are Jarvis, the friendly voice assistant of this family's home hub. You are talking to Mom (parent). " +
  'Family: Mom (parent), Dad (parent), Ana (child), Ben (child). Answer in 1 or 2 short sentences.';
const SET_ALARM = {
  type: 'function',
  function: {
    name: 'set_alarm',
    description: 'Set an alarm or reminder for someone. Use inMinutes for "in 10 minutes", time for a clock time.',
    parameters: {
      type: 'object',
      properties: {
        person: { type: 'string', description: 'Who it rings for. Leave empty for the speaker' },
        time: { type: 'string', description: 'Clock time, e.g. "06:30" or "6:30 pm"' },
        inMinutes: { type: 'integer' },
        label: { type: 'string' },
      },
    },
  },
};
const JARVIS_RUNS = 3;

const args = process.argv.slice(2);
const gpuFlag = args.find((a) => a.startsWith('--gpu='))?.slice(6);
const OPTIONS = { ...CHAT_OPTIONS, temperature: 0.2 };
if (gpuFlag === 'auto') delete OPTIONS.num_gpu;
else if (gpuFlag) OPTIONS.num_gpu = Number(gpuFlag);
const gpuSetting = OPTIONS.num_gpu === undefined ? 'auto' : String(OPTIONS.num_gpu);
const modelArgs = args.filter((a) => !a.startsWith('--'));
const models = modelArgs.length ? modelArgs : [MODEL];
const names = await installedModels();
if (!names) {
  console.error(`Ollama isn't running at ${OLLAMA}. Start it with "npm run ai".`);
  process.exit(1);
}

let thinkOff = true;
async function chat(model, content, format, extra = {}) {
  const messages = extra.system ? [{ role: 'system', content: extra.system }, { role: 'user', content }] : [{ role: 'user', content }];
  const body = { model, messages, stream: false, format, tools: extra.tools, options: OPTIONS };
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    body: JSON.stringify(thinkOff ? { ...body, think: false } : body),
  });
  const data = await res.json();
  if (data.error && /does not support thinking/i.test(data.error) && thinkOff) {
    thinkOff = false;
    return chat(model, content, format, extra);
  }
  if (data.error) throw new Error(data.error);
  return data;
}

const report = [
  '# AI benchmark',
  '',
  `Machine: ${process.platform}, ${new Date().toLocaleString()}. Context ${OPTIONS.num_ctx}, GPU layers ${gpuSetting}.`,
  '',
];
const summary = [];

for (const model of models) {
  if (!isInstalled(names, model)) {
    console.warn(`Skipping ${model}: run "ollama pull ${model}" first`);
    continue;
  }
  thinkOff = true;
  console.log(`\n▶ ${model}: loading…`);
  // Unload first: Ollama reuses an already-loaded copy (e.g. the API's) even when the GPU layers differ.
  await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model, keep_alive: 0 }) });
  const load = await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model, prompt: '', options: OPTIONS }) })
    .then((r) => r.json());
  // How much of the model sits on the GPU (the rest runs on the CPU, much slower).
  const loaded = (await fetch(`${OLLAMA}/api/ps`).then((r) => r.json())).models?.find((m) => m.name === model || m.name === `${model}:latest`);
  const onGpu = loaded?.size ? Math.round((loaded.size_vram / loaded.size) * 100) : 0;
  console.log(`  ${onGpu}% of the model on the GPU (GPU layers: ${gpuSetting})`);
  report.push(`## ${model}`, '', `Load time: ${(load.load_duration / 1e9 || 0).toFixed(1)} s. On the GPU: ${onGpu}%.`, '');

  let seconds = 0;
  let tokens = 0;
  let generating = 0;
  for (const question of QUESTIONS) {
    const started = Date.now();
    const data = await chat(model, question);
    seconds += (Date.now() - started) / 1000;
    tokens += data.eval_count ?? 0;
    generating += (data.eval_duration ?? 0) / 1e9;
    console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s  ${question}`);
    report.push(`**${question}**`, '', data.message.content.trim(), '');
  }

  const started = Date.now();
  const quiz = await chat(model, QUIZ_PROMPT, QUIZ_SCHEMA);
  let jsonOk = false;
  try {
    const parsed = JSON.parse(quiz.message.content);
    jsonOk = Array.isArray(parsed.questions) && parsed.questions.length > 0 && parsed.questions.every((q) => q.choices?.length);
  } catch {}
  console.log(`  ${((Date.now() - started) / 1000).toFixed(1)}s  JSON quiz: ${jsonOk ? 'valid' : 'INVALID'}`);
  report.push(`**${QUIZ_PROMPT}** (JSON ${jsonOk ? 'valid' : 'invalid'})`, '', '```json', quiz.message.content.trim(), '```', '');

  // Jarvis tool call, timed like a voice turn (median of JARVIS_RUNS).
  const turns = [];
  let toolOk = 0;
  for (let i = 0; i < JARVIS_RUNS; i++) {
    const t0 = Date.now();
    const data = await chat(model, 'Wake Ana up in four minutes', undefined, { system: JARVIS_SYSTEM, tools: [SET_ALARM] });
    turns.push((Date.now() - t0) / 1000);
    const call = data.message.tool_calls?.[0]?.function;
    if (call?.name === 'set_alarm' && Number(call.arguments?.inMinutes) === 4 && /ana/i.test(call.arguments?.person ?? '')) toolOk++;
  }
  const turn = turns.sort((a, b) => a - b)[Math.floor(turns.length / 2)];
  console.log(`  ${turn.toFixed(1)}s  Jarvis tool call (median of ${JARVIS_RUNS}): ${toolOk}/${JARVIS_RUNS} correct`);
  report.push(`**Jarvis: "Wake Ana up in four minutes"** → set_alarm correct ${toolOk}/${JARVIS_RUNS}, median ${turn.toFixed(1)} s`, '');

  summary.push({
    model,
    'GPU layers': gpuSetting,
    'on GPU': `${onGpu}%`,
    'Jarvis turn (s)': turn.toFixed(1),
    'tool call': `${toolOk}/${JARVIS_RUNS}`,
    'seconds per answer': (seconds / QUESTIONS.length).toFixed(1),
    'words/sec (≈tokens/sec)': (tokens / (generating || 1)).toFixed(1),
    'JSON quiz': jsonOk ? 'valid' : 'invalid',
  });
}

console.log('');
console.table(summary);
writeFileSync('ai-bench.md', [...report, '## Summary', '', ...summary.map((s) => `- ${Object.values(s).join(' | ')}`)].join('\n'));
console.log('Answers saved to ai-bench.md — read them to compare quality (especially Tagalog).');
