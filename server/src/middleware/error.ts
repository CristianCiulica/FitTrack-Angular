import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Invalid request body', details: err.flatten() });
    return;
  }

  console.error('[error]', err);
  const status = (err as { status?: number })?.status ?? 500;
  const message = (err as Error)?.message ?? 'Internal server error';
  res.status(status).json({ error: message });
}
