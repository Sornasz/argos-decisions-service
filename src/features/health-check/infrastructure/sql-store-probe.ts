import type { SqlPoolProvider } from '../../../shared/persistence.js';
import type { StoreProbe } from '../application/ports/store-probe.js';

export class SqlStoreProbe implements StoreProbe {
  constructor(private readonly pool: SqlPoolProvider) {}

  async ping(): Promise<void> {
    await (await this.pool()).request().query('SELECT 1 AS ok');
  }
}
