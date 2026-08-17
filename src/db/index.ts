import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

const { Pool } = pg;

// Add global connection pool caching to persist across hot-reloads
declare global {
  var _postgresPool: InstanceType<typeof Pool> | undefined;
}

// Function to create or retrieve the connection pool.
export const createPool = () => {
  if (!global._postgresPool) {
    const host = process.env.SQL_HOST;
    const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
    const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
    const database = process.env.SQL_DB_NAME;

    console.log(`[Database Pool] Inicializando pool PostgreSQL: user=${user}, database=${database}, host=${host}`);

    global._postgresPool = new Pool({
      host,
      user,
      password,
      database,
      max: 10,
      connectionTimeoutMillis: 15000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err: Error) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};


// Create or retrieve the pool instance.
const pool = createPool();

// Initialize Drizzle with the pool and schema.
export const db = drizzle(pool, { schema });
