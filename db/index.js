const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'urban_exposure',
  connectionTimeoutMillis: 3000,
  query_timeout: 5000,
});
pool.on('error', error => console.error('PostgreSQL:', error.message));

const db = drizzle({ client: pool });
module.exports = { db, pool };
