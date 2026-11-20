import pg from 'pg';

/**
 * Optional PostgreSQL connection for saved games, accounts and leaderboards.
 * Set DATABASE_URL to enable it; the single-player demo does not need it.
 */
export const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

// Idle-client errors (e.g. a database restart) must not crash the server.
pool?.on('error', (err) => console.error('PostgreSQL pool error:', err.message));

export async function checkDatabase(): Promise<'disabled' | 'ok' | 'error'> {
  if (!pool) return 'disabled';
  try {
    await pool.query('select 1');
    return 'ok';
  } catch {
    return 'error';
  }
}
