// `npm run ai:bench -- qwen3.5:4b gemma4:e4b` (no names = AI_MODEL from api/.env)
// Asks every model the same questions (English + Tagalog + a JSON task) and compares speed and answers.
// Answers are saved to ai-bench.md so you can read them side by side.
import { writeFileSync } from 'node:fs';
import { MODEL, OLLAMA, installedModels, isInstalled } from './ollama.mjs';

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

const models = process.argv.slice(2).length ? process.argv.slice(2) : [MODEL];
const names = await installedModels();
if (!names) {
  console.error(`Ollama isn't running at ${OLLAMA}. Start it with "npm run ai".`);
  process.exit(1);
}

let thinkOff = true;
async function chat(model, content, format) {
  const body = { model, messages: [{ role: 'user', content }], stream: false, format, options: { temperature: 0.2 } };
  const res = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST',
    body: JSON.stringify(thinkOff ? { ...body, think: false } : body),
  });
  const data = await res.json();
  if (data.error && /does not support thinking/i.test(data.error) && thinkOff) {
    thinkOff = false;
    return chat(model, content, format);
  }
  if (data.error) throw new Error(data.error);
  return data;
}

const report = ['# AI benchmark', '', `Machine: ${process.platform}, ${new Date().toLocaleString()}`, ''];
const summary = [];

for (const model of models) {
  if (!isInstalled(names, model)) {
    console.warn(`Skipping ${model}: run "ollama pull ${model}" first`);
    continue;
  }
  thinkOff = true;
  console.log(`\n▶ ${model}: loading…`);
  const load = await fetch(`${OLLAMA}/api/generate`, { method: 'POST', body: JSON.stringify({ model, prompt: '' }) })
    .then((r) => r.json());
  report.push(`## ${model}`, '', `Load time: ${(load.load_duration / 1e9 || 0).toFixed(1)} s`, '');

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

  summary.push({
    model,
    'seconds per answer': (seconds / QUESTIONS.length).toFixed(1),
    'words/sec (≈tokens/sec)': (tokens / (generating || 1)).toFixed(1),
    'JSON quiz': jsonOk ? 'valid' : 'invalid',
  });
}

console.log('');
console.table(summary);
writeFileSync('ai-bench.md', [...report, '## Summary', '', ...summary.map((s) => `- ${Object.values(s).join(' | ')}`)].join('\n'));
console.log('Answers saved to ai-bench.md — read them to compare quality (especially Tagalog).');
