import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { healthPaths } from './api/health.openapi.js';
import { createHealthRouter } from './api/health.router.js';
import { CheckHealth } from './application/check-health.use-case.js';
import { memoryStoreProbe } from './infrastructure/memory-store-probe.js';
import { SqlStoreProbe } from './infrastructure/sql-store-probe.js';

export interface HealthCheckFeatureOptions {
  readonly persistence: Persistence;
  readonly receiverEnabled: boolean;
}

export function createHealthCheckFeature(options: HealthCheckFeatureOptions): FeatureHttp {
  const useCase = new CheckHealth({
    probe: options.persistence.kind === 'sql' ? new SqlStoreProbe(options.persistence.pool) : memoryStoreProbe,
    store: options.persistence.kind,
    receiverEnabled: options.receiverEnabled,
  });
  return { router: createHealthRouter(useCase), openApiPaths: healthPaths };
}
