import { Pool } from 'pg';

let pool: Pool;

export const setupDatabase = () => {
  pool = new Pool({
    connectionString: process.env.PG_URL || 'postgres://user:pass@postgres:5432/db'
  });

  pool.on('error', (err: Error) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });

  return pool;
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
}; 