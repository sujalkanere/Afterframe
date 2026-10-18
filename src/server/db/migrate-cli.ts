import { loadEnvFile } from '../env.js';
import { createDatabase } from './index.js';

loadEnvFile();

async function main() {
  const db = await createDatabase();
  const applied = await db.query<{ version: string; applied_at: string }>(
    'SELECT version, applied_at FROM schema_migrations ORDER BY version ASC'
  );
  console.log(
    JSON.stringify(
      {
        status: 'migrated',
        engine: db.engine,
        migrations: applied.rows,
      },
      null,
      2
    )
  );
  await db.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
