// Creates api/.env and mobile/.env from their .env.example on first setup, with a random JWT secret.
import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

for (const dir of ['api', 'mobile']) {
  const env = `${dir}/.env`;
  if (existsSync(env) || !existsSync(`${dir}/.env.example`)) continue;
  copyFileSync(`${dir}/.env.example`, env);
  const text = readFileSync(env, 'utf8');
  writeFileSync(env, text.replace('change-me-to-a-long-random-string', randomBytes(32).toString('hex')));
  console.log(`Created ${env}`);
}
