import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Wrap an async route so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Standard success envelope. */
export function sendData<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data });
}
