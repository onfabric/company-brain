import { type ErrorHandler, StatusMap } from 'elysia';
import { createLogger } from '#lib/logger.ts';

const errorLogger = createLogger();

export class AppError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(StatusMap['Bad Request'], message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(StatusMap.Unauthorized, message);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(StatusMap['Not Found'], message);
    this.name = 'NotFoundError';
  }
}

type ErrorHandlerOptions = Parameters<ErrorHandler>[0];
type ErrorHandlerResult = ReturnType<ErrorHandler>;

export function elysiaErrorHandler({
  error,
  code,
  status,
}: ErrorHandlerOptions): ErrorHandlerResult {
  errorLogger.error(code, error);
  if (error instanceof AppError) {
    return status(error.statusCode, { error: error.message });
  }
  if (code === 'VALIDATION') {
    return status(StatusMap['Bad Request'], { error: 'Validation error', details: error.message });
  }
  if (code === 'NOT_FOUND') {
    return status(StatusMap['Not Found'], { error: 'Not Found' });
  }
  return status(StatusMap['Internal Server Error'], { error: 'Internal server error' });
}
