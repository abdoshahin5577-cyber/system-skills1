import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppError, Errors } from '../shared/errors';

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

export function normalizeError(err: unknown): NormalizedError {
  if (err instanceof AppError) {
    return { statusCode: err.statusCode, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof ZodError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    };
  }
  if (err instanceof mongoose.Error.CastError) {
    return { statusCode: 400, code: 'INVALID_ID', message: `Invalid value for "${err.path}"` };
  }
  const anyErr = err as { code?: unknown; type?: unknown; keyPattern?: Record<string, unknown> };
  if (anyErr?.code === 11000) {
    return {
      statusCode: 409,
      code: 'DUPLICATE',
      message: 'Resource already exists',
      details: anyErr.keyPattern ? { fields: Object.keys(anyErr.keyPattern) } : undefined,
    };
  }
  if (anyErr?.type === 'entity.parse.failed') {
    return { statusCode: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' };
  }
  if (anyErr?.type === 'entity.too.large') {
    return { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' };
  }
  return {
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'production' ? 'Internal server error' : String((err as Error)?.message ?? err),
  };
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(Errors.notFound(`Route ${req.method} ${req.path} not found`));
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const normalized = normalizeError(err);
  if (normalized.statusCode >= 500) req.log.error({ err }, 'Unhandled error');
  else req.log.debug({ err }, 'Request failed');
  res.status(normalized.statusCode).json({
    success: false,
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details !== undefined ? { details: normalized.details } : {}),
      requestId: req.requestId,
    },
  });
};
