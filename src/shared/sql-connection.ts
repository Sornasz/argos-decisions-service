import sql from 'mssql';

export async function connectSqlPool(connectionString: string): Promise<sql.ConnectionPool> {
  const pool = new sql.ConnectionPool(connectionString);
  await pool.connect();
  return pool;
}

/**
 * Abre o pool na primeira chamada e reaproveita depois. Se a conexão falhar,
 * a próxima chamada tenta de novo em vez de guardar a promise rejeitada.
 */
export function lazySqlPool(connectionString: string): () => Promise<sql.ConnectionPool> {
  let pending: Promise<sql.ConnectionPool> | null = null;
  return () => {
    pending ??= connectSqlPool(connectionString).catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}
