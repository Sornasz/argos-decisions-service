import type { ConnectionPool } from 'mssql';
import type { MemoryDatabase } from './memory-database.js';

export type SqlPoolProvider = () => Promise<ConnectionPool>;

/** Como as features chegam aos dados: Azure SQL, ou memória apenas em desenvolvimento. */
export type Persistence =
  | { readonly kind: 'sql'; readonly pool: SqlPoolProvider }
  | { readonly kind: 'memory'; readonly database: MemoryDatabase };
