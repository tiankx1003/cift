import { Response } from 'express';

// Unified API response format

export interface ApiSuccess<T> {
  code: 0;
  message: 'success';
  data: T;
}

export interface ApiList<T> {
  code: 0;
  message: 'success';
  data: {
    items: T[];
    total: number;
  };
}

export interface ApiError {
  code: number;
  message: string;
  details: unknown;
}

// Error code ranges
export const ErrorCodes = {
  // Parameter errors
  INVALID_PARAM: 40001,
  MISSING_PARAM: 40002,

  // Auth/permission errors
  UNAUTHORIZED: 40101,
  TOKEN_EXPIRED: 40102,
  FORBIDDEN: 40103,

  // Resource not found
  NOT_FOUND: 40401,
  KB_NOT_FOUND: 40402,
  DOC_NOT_FOUND: 40403,

  // Conflicts
  ALREADY_EXISTS: 40901,

  // Internal errors
  INTERNAL: 50001,
  SERVICE_UNAVAILABLE: 50002,
} as const;

export function success<T>(res: Response, data: T, status = 200) {
  res.status(status).json({ code: 0, message: 'success', data });
}

export function created<T>(res: Response, data: T) {
  success(res, data, 201);
}

export function list<T>(res: Response, items: T[], total?: number) {
  res.json({
    code: 0,
    message: 'success',
    data: {
      items,
      total: total ?? items.length,
    },
  });
}

export function error(res: Response, code: number, message: string, status?: number, details?: unknown) {
  const httpStatus = status || _codeToStatus(code);
  res.status(httpStatus).json({ code, message, details: details ?? null });
}

function _codeToStatus(code: number): number {
  if (code >= 40001 && code <= 40099) return 400;
  if (code >= 40101 && code <= 40199) return 401;
  if (code >= 40401 && code <= 40499) return 404;
  if (code >= 40901 && code <= 40999) return 409;
  return 500;
}
