import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Hub mode (`npm run hub`, SERVE_WEB=true): the API also serves the built web app (web/dist),
// so the whole app is one URL on the local network.
export const WEB_DIST = resolve(process.env.WEB_DIST || join(__dirname, '..', '..', 'web', 'dist'));

const indexFile = join(WEB_DIST, 'index.html');
export const webIndex =
  process.env.SERVE_WEB === 'true' && existsSync(indexFile) ? readFileSync(indexFile) : null;
