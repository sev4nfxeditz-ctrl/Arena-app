import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { env } from './config/env';

async function migrate() {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  console.log('🔄 Running database migrations...');

  const migrationsDir = path.join(__dirname, '..', '..', '..', 'server', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    console.log(`  📄 Running ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

    try {
      await pool.query(sql);
      console.log(`  ✅ ${file} completed`);
    } catch (err) {
      console.error(`  ❌ ${file} failed:`, err);
      throw err;
    }
  }

  console.log('✅ All migrations completed!');
  await pool.end();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
