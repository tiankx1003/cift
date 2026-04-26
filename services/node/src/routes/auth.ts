import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import { pool } from '../db.js';
import { config } from '../config.js';
import { authRequired } from '../middleware/auth.js';

export const authRouter = Router();

function signToken(userId: string, username: string) {
  return jwt.sign({ userId, username }, config.jwtSecret, { expiresIn: '24h' });
}

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: 用户注册
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string, example: admin }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       201: { description: 注册成功 }
 *       400: { description: 参数错误 }
 *       409: { description: 用户名已存在 }
 */
// POST /api/auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ code: 400, message: 'username and password are required' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ code: 400, message: 'password must be at least 6 characters' });
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    res.status(409).json({ code: 409, message: 'username already taken' });
    return;
  }

  const id = uuid();
  const hash = await bcrypt.hash(password, 10);
  await pool.query('INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3)', [id, username, hash]);

  const token = signToken(id, username);
  res.status(201).json({ user: { id, username }, token });
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: 用户登录
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, password]
 *             properties:
 *               username: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: 登录成功，返回 JWT }
 *       401: { description: 凭据无效 }
 */
// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ code: 400, message: 'username and password are required' });
    return;
  }

  const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
  if (result.rows.length === 0) {
    res.status(401).json({ code: 401, message: 'invalid credentials' });
    return;
  }

  const user = result.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ code: 401, message: 'invalid credentials' });
    return;
  }

  const token = signToken(user.id, user.username);
  res.json({ user: { id: user.id, username: user.username }, token });
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: 获取当前用户信息
 *     responses:
 *       200: { description: 用户信息 }
 *       401: { description: 未认证 }
 */
// GET /api/auth/me
authRouter.get('/me', authRequired, async (req: Request, res: Response) => {
  const result = await pool.query('SELECT id, username, created_at FROM users WHERE id = $1', [req.user!.userId]);
  if (result.rows.length === 0) {
    res.status(404).json({ code: 404, message: 'user not found' });
    return;
  }
  res.json(result.rows[0]);
});
