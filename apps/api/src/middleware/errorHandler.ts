import type { Request, Response, NextFunction } from 'express';
import { AppError } from '@ndtech/core';
import type { ApiError } from '@ndtech/shared';

/** Maps thrown errors (typed AppError or otherwise) to JSON responses. */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    const body: ApiError = { error: err.message, code: err.code, details: err.details };
    res.status(err.status).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal server error.';
  // Log the full error server-side; never leak stack traces to clients.
  console.error('[api] unhandled error:', err);
  const body: ApiError = { error: message, code: 'INTERNAL_ERROR' };
  res.status(500).json(body);
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Route not found.', code: 'ROUTE_NOT_FOUND' } satisfies ApiError);
}
