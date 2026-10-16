import { createWriteStream, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import morgan from 'morgan';
import { env } from './env.js';

const directory = fileURLToPath(new URL('../../logs/', import.meta.url));
mkdirSync(directory, { recursive: true });
const accessStream = createWriteStream(new URL('../../logs/access.log', import.meta.url), { flags: 'a' });
const errorStream = createWriteStream(new URL('../../logs/error.log', import.meta.url), { flags: 'a' });

export function safeRequestPath(rawUrl = '') {
  return rawUrl.split('?')[0].replace(
    /^\/api\/tickets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/check-in$/i,
    '/api/tickets/[redacted]/check-in'
  );
}

morgan.token('url', (req) => safeRequestPath(req.originalUrl ?? req.url));

export const requestLoggers = [
  ...(env.NODE_ENV === 'test' ? [] : [morgan('dev')]),
  morgan('combined', { stream: accessStream }),
  morgan('combined', { stream: errorStream, skip: (_req, res) => res.statusCode < 400 })
];
