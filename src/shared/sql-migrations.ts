import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import sql from 'mssql';

const CREATE_MIGRATIONS_TABLE = `
IF OBJECT_ID('dbo.schema_migracao', 'U') IS NULL
  CREATE TABLE dbo.schema_migracao (
    versao      NVARCHAR(200) NOT NULL CONSTRAINT pk_schema_migracao PRIMARY KEY,
    aplicada_em DATETIME2(3)  NOT NULL CONSTRAINT df_schema_migracao_aplicada_em DEFAULT SYSUTCDATETIME()
  );
`;

/** `GO` não é T-SQL; é o separador de batches usado por sqlcmd e SSMS. */
export function splitBatches(script: string): string[] {
  return script
    .split(/^\s*GO\s*;?\s*$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
}

/**
 * Aplica, em ordem de nome, os arquivos `.sql` de `directory` que ainda não
 * constam em dbo.schema_migracao. Cada arquivo roda numa transação própria.
 */
export async function applyMigrations(pool: sql.ConnectionPool, directory: string): Promise<string[]> {
  await pool.request().batch(CREATE_MIGRATIONS_TABLE);
  const applied = new Set(
    (await pool.request().query<{ versao: string }>('SELECT versao FROM dbo.schema_migracao')).recordset.map(
      (row) => row.versao,
    ),
  );

  const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const batches = splitBatches(await readFile(join(directory, file), 'utf8'));
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      for (const batch of batches) {
        await new sql.Request(transaction).batch(batch);
      }
      await new sql.Request(transaction)
        .input('versao', sql.NVarChar(200), file)
        .query('INSERT INTO dbo.schema_migracao (versao) VALUES (@versao)');
      await transaction.commit();
      newlyApplied.push(file);
    } catch (error) {
      await transaction.rollback().catch(() => undefined);
      throw new Error(`Falha ao aplicar a migration ${file}: ${(error as Error).message}`, { cause: error });
    }
  }

  return newlyApplied;
}
