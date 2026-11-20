import pg from 'pg';

/**
 * Optional PostgreSQL connection for saved games, accounts and leaderboards.
 * Set DATABASE_URL to enable it; the single-player demo does not need it.
 */
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export async function checkDatabase(): Promise<'disabled' | 'ok' | 'error'> {
  if (!pool) return 'disabled';
  try {
    await pool.query('select 1');
    return 'ok';
  } catch {
    return 'error';
  }
}
