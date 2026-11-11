export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message = 'Bad request', details?: unknown) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'You do not have permission to perform this action') =>
    new AppError(403, 'FORBIDDEN', message),
  // Use notFound (not forbidden) for resources outside the caller's tenant so IDs cannot be probed.
  notFound: (message = 'Resource not found') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message = 'Resource already exists', details?: unknown) =>
    new AppError(409, 'CONFLICT', message, details),
  validation: (details: unknown, message = 'Validation failed') =>
    new AppError(422, 'VALIDATION_ERROR', message, details),
  tooManyRequests: (message = 'Too many requests') => new AppError(429, 'RATE_LIMITED', message),
};
