import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { pool } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; username: string };
      apiKeyAuth?: boolean;
    }
  }
}

/**
 * Extract user from API Key.
 * Looks for `Authorization: Bearer ck-...` or `X-API-Key: ck-...`.
 * Sets req.user and req.apiKeyAuth = true on success, otherwise calls next().
 */
export async function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const prefix = 'ck-';

  // Try Authorization: Bearer ck-...
  let apiKey: string | undefined;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7).startsWith(prefix)) {
    apiKey = authHeader.slice(7).trim();
  }

  // Try X-API-Key header
  if (!apiKey) {
    const xKey = req.headers['x-api-key'];
    if (typeof xKey === 'string' && xKey.startsWith(prefix)) {
      apiKey = xKey.trim();
    }
  }

  if (!apiKey) {
    return next(); // Not an API Key request, let JWT middleware handle it
  }

  try {
    const { rows } = await pool.query(
      'SELECT ak.id, ak.user_id, u.username FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.key = $1 AND ak.is_active = TRUE',
      [apiKey]
    );
    if (rows.length === 0) {
      res.status(401).json({ code: 40103, message: 'Invalid API key', details: null });
      return;
    }

    // Update last_used_at (fire-and-forget)
    pool.query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [rows[0].id]).catch(() => {});

    req.user = { userId: rows[0].user_id, username: rows[0].username };
    req.apiKeyAuth = true;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Combined auth: API Key OR JWT. Either one passing is sufficient.
 */
export function anyAuth(req: Request, res: Response, next: NextFunction) {
  // apiKeyAuth already set req.user if valid key was found
  if (req.user) return next();

  // Fall back to JWT check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 40101, message: 'Authentication required', details: null });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string; username: string };
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    res.status(401).json({ code: 40102, message: 'Invalid or expired token', details: null });
  }
}
