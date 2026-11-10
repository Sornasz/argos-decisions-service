import type { FeatureHttp } from '../../shared/feature-http.js';
import type { Persistence } from '../../shared/persistence.js';
import { decisionMetricsPaths } from './api/decision-metrics.openapi.js';
import { createDecisionMetricsRouter } from './api/decision-metrics.router.js';
import { GetDecisionMetrics } from './application/get-decision-metrics.use-case.js';
import type { DecisionTotalsReader } from './application/ports/decision-totals-reader.js';
import { MemoryDecisionTotalsReader } from './infrastructure/memory-decision-totals-reader.js';
import { SqlDecisionTotalsReader } from './infrastructure/sql-decision-totals-reader.js';

export function createDecisionMetricsFeature(options: { readonly persistence: Persistence }): FeatureHttp {
  const totals: DecisionTotalsReader =
    options.persistence.kind === 'sql'
      ? new SqlDecisionTotalsReader(options.persistence.pool)
      : new MemoryDecisionTotalsReader(options.persistence.database);
  return { router: createDecisionMetricsRouter(new GetDecisionMetrics(totals)), openApiPaths: decisionMetricsPaths };
}
