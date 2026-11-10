import { fileURLToPath } from 'node:url';
import { applyMigrations, connectSqlPool } from '../shared/index.js';

// src/bootstrap e dist/bootstrap ficam no mesmo nível, então o caminho vale nos dois casos.
const MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../../db/migrations', import.meta.url));

const connectionString = process.env.SQL_CONNECTION_STRING?.trim();
if (!connectionString) {
  console.error('Defina SQL_CONNECTION_STRING para aplicar as migrations.');
  process.exit(1);
}

const pool = await connectSqlPool(connectionString);
try {
  const applied = await applyMigrations(pool, MIGRATIONS_DIRECTORY);
  console.info(applied.length > 0 ? `Migrations aplicadas: ${applied.join(', ')}` : 'Nenhuma migration pendente.');
} finally {
  await pool.close();
}
