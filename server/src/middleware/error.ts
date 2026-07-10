import type { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
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

  // id invalid in URL (ex. id temporar creat offline) — nu e o eroare interna
  if (err instanceof MongooseError.CastError) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }

  console.error('[error]', err);
  const status = (err as { status?: number })?.status ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = (err as Error)?.message ?? 'Internal server error';
  
  res.status(status).json({ 
    error: status === 500 && isProduction ? 'Internal server error' : message 
  });
}
