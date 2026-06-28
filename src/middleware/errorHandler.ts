import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error & { status?: number; fieldErrors?: Record<string, string> }, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  if (status === 500) {
    console.error('Internal error:', err);
  }
  const response: Record<string, unknown> = { message };
  if (err.fieldErrors) {
    response.fieldErrors = err.fieldErrors;
  }
  res.status(status).json(response);
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ message: 'Route not found' });
}
