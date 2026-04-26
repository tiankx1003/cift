import { Request, Response, NextFunction } from 'express';
import { ErrorCodes } from '../utils/apiResponse.js';

export interface AppError extends Error {
  status?: number;
  code?: number;
  details?: unknown;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  const code = err.code || (status >= 500 ? ErrorCodes.INTERNAL : ErrorCodes.INVALID_PARAM);
  const message = err.message || 'Internal server error';
  res.status(status).json({ code, message, details: err.details || null });
}
