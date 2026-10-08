import { existsSync } from 'node:fs';

// Imported first in main.ts so every module sees the .env values.
if (existsSync('.env')) process.loadEnvFile('.env');

// Anyone who knows JWT_SECRET can forge a login, so refuse to start without a real one.
const secret = process.env.JWT_SECRET ?? '';
if (!secret) throw new Error('JWT_SECRET is missing. Set it in api/.env.');
if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret.startsWith('change-me'))) {
  throw new Error('JWT_SECRET must be a random string of 32+ characters in production.');
}
