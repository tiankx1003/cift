import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(64) UNIQUE NOT NULL,
      password_hash VARCHAR(256) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Add user_id column to knowledge_bases if table and column don't exist yet
  const tableCheck = await pool.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'knowledge_bases'
  `);
  if (tableCheck.rows.length > 0) {
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'knowledge_bases' AND column_name = 'user_id'
    `);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE knowledge_bases ADD COLUMN user_id VARCHAR(36)`);
    }
  }

  // API Keys table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key VARCHAR(128) UNIQUE NOT NULL,
      name VARCHAR(128) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      last_used_at TIMESTAMP
    )
  `);

  console.log('Database migration complete');
}
