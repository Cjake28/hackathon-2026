// Creates api/.env and mobile/.env from their .env.example on first setup, with a random JWT secret.
import { randomBytes } from 'node:crypto';
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

for (const dir of ['api', 'mobile']) {
  const env = `${dir}/.env`;
  if (existsSync(env) || !existsSync(`${dir}/.env.example`)) continue;
  copyFileSync(`${dir}/.env.example`, env);
  const text = readFileSync(env, 'utf8');
  writeFileSync(
    env,
    text
      .replace('change-me-to-a-long-random-string', randomBytes(32).toString('hex'))
      .replace('change-me-hub-key', randomBytes(16).toString('hex')),
  );
  console.log(`Created ${env}`);
}

// Family hub: api/.env files made before the hub existed get a HUB_KEY too (shared with the Python voice service).
if (existsSync('api/.env') && !/^HUB_KEY=/m.test(readFileSync('api/.env', 'utf8'))) {
  appendFileSync(
    'api/.env',
    `
# Family hub: copy HUB_KEY into voice/.env
HUB_KEY="${randomBytes(16).toString('hex')}"
VOICE_URL="http://127.0.0.1:4103"
`,
  );
  console.log('Added HUB_KEY and VOICE_URL to api/.env');
}
