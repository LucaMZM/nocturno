import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

export function errorMiddleware(error, _req, res, _next) {
  let result = error;
  if (error instanceof ZodError) {
    result = new AppError(400, 'VALIDATION_ERROR', 'Invalid request', error.issues.map(({ path, message }) => ({ path: path.join('.'), message })));
  } else if (!(error instanceof AppError)) {
    if (error.type === 'entity.parse.failed') result = new AppError(400, 'INVALID_JSON', 'Invalid JSON body');
    else if (error.type === 'entity.too.large') result = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    else if (error.code === '23505') result = new AppError(409, 'CONFLICT', 'Resource already exists');
    else if (error.code === '23503') result = new AppError(409, 'CONFLICT', 'Resource is referenced or related resource is missing');
    else if (error.code === '23514' || error.code === '23502' || error.code?.startsWith?.('22')) result = new AppError(422, 'VALIDATION_ERROR', 'Database constraint violated');
    else if (error.code?.startsWith?.('08') || ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code))
      result = new AppError(503, 'DATABASE_UNAVAILABLE', 'Service temporarily unavailable');
    else result = new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
  }
  if (env.NODE_ENV === 'development' && result.status >= 500) console.error('API request failed', { code: result.code, type: error.name ?? 'Error' });
  res.status(result.status).json({ error: { code: result.code, message: result.message, details: result.details } });
}
